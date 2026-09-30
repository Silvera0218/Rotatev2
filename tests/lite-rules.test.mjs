import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadEngine, settle } from '../tools/simulate_balance.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const original = loadEngine(null, root + 'index.html');
const context = vm.createContext({ console, structuredClone, performance, LITE_DICE_ROUTES:JSON.parse(fs.readFileSync(new URL('../lite-dice-routes.json',import.meta.url),'utf8')) });
vm.runInContext(original.source, context);
vm.runInContext(fs.readFileSync(new URL('../lite-rules.js', import.meta.url), 'utf8'), context);
vm.runInContext('installRotationLite(api)', context);
const { Game } = context.api;
const make = () => new Game(42);
const originalRoutes=['shop','tool','buff','special'];
const scripted = (game, values) => {
  game.lite.diceSides=[8,8,8]; // Keep existing reward fixtures on their original three D8s.
  game.lite.routeChoices=[...originalRoutes];
  let cursor = 0;
  game.liteRandom = () => values[cursor++] ?? 0.99;
};
const finishObjective = game => {
  while (game.phase === 'play') {
    game.board = game.target.cells.map(c => ({ ...c, id: game.id++, type: 'L' }));
    assert.equal(game.checkClear(), true);
    settle(game);
  }
  assert.equal(game.phase, 'checkpoint-complete');
};

test('copy retains original tetromino shapes and movement', () => {
  const g = make();
  const baseline = new original.Game(42);
  assert.equal(g.active.type, baseline.active.type);
  assert.deepEqual(JSON.parse(JSON.stringify(g.active.shape)), JSON.parse(JSON.stringify(baseline.active.shape)));
  assert.equal(g.stageCommitted, true);
  const x = g.active.x;
  assert.equal(g.move(1, 0), true);
  assert.equal(g.active.x, x + 1);
  assert.equal(g.rotatePiece(), true);
  assert.deepEqual(Object.keys(g.pixelCards), []);
  assert.equal(g.specialBlocks.length, 0);
});

test('score gate ignores clear count, rejects below goal, and accepts exact and excess scores', () => {
  for(const score of [44,45,46]){
    const g=make();g.lite.clears=100;g.checkpointScore=score;
    assert.equal(g.completeCheckpoint(),score>=45);
    if(score>=45){assert.equal(g.active,null);assert.equal(g.events.at(-1).goal,45);}
  }
  const g=make();g.score=99999;g.checkpointScore=0;
  assert.equal(g.completeCheckpoint(),false);
  const area=g.target.cells.length;finishObjective(g);
  assert.ok(g.checkpointScore>=g.goal);assert.equal(g.target.cells.length,area);
  assert.ok(g.events.some(e=>e.kind==='clear'));assert.equal(g.active,null);
});

test('four actual drops clear an outline but do not pass a score goal prematurely', () => {
  const g = make();
  const paths = [
    Array(12).fill('down'),
    [...Array(10).fill('down'), 'rotate'],
    ['right', 'right', ...Array(10).fill('down'), 'rotate', 'down', 'down'],
    ['left', ...Array(11).fill('down'), 'rotate', 'down', 'rotate', 'rotate', 'down']
  ];
  for (const path of paths) {
    for (const action of path) {
      const legal = action === 'rotate' ? g.rotatePiece()
        : g.move(action === 'left' ? -1 : action === 'right' ? 1 : 0, action === 'down' ? -1 : 0);
      assert.equal(legal, true);
    }
    g.drop();
    settle(g);
  }
  assert.equal(g.phase, 'play');
  assert.ok(g.checkpointScore<g.goal);
  assert.equal(g.dropsUsed, 4);
  assert.equal(g.lite.clears, 1);
  assert.ok(g.score > 0);
});

test('completed real rotor turn drops once; no drop on piece rotation or repeated finish', () => {
  const g = make();
  scripted(g, [0.01, 0.01]);
  const initial = g.lite.tools.shovel;
  g.rotatePiece();
  assert.equal(g.lite.tools.shovel, initial);
  g.board = [{ x: 1, y: 0, id: g.id++, type: 'L' }];
  g.beginRotation({ lever: 1, dir: -1 });
  g.finishRotation();
  assert.equal(g.lite.tools.shovel, initial + 1);
  g.finishRotation();
  assert.equal(g.lite.tools.shovel, initial + 1);
  assert.equal(g.events.filter(e => e.kind === 'lite-drop').length, 1);
});

test('rotation miss and invalid overflow never award a tool', () => {
  for (const overflow of [false, true]) {
    const g = make();
    scripted(g, [overflow ? 0 : 0.06]);
    const total = g.lite.tools.shovel + g.lite.tools.swap;
    g.board = [{ x: overflow ? 100 : 1, y: 0, id: g.id++, type: 'L' }];
    g.beginRotation({ lever: 1, dir: -1 });
    g.finishRotation();
    assert.equal(g.lite.tools.shovel + g.lite.tools.swap, total);
    if (overflow) assert.equal(g.phase, 'lost');
  }
});

test('one sum selects Buff, entry credits once, and selection gates the next level', () => {
  const g=make();finishObjective(g);scripted(g,[.5,.5,.5]);
  const roll=g.liteRoll();
  assert.equal(roll.values.join(','),'5,5,5');assert.equal(roll.total,15);assert.equal(roll.route,'buff');
  assert.equal(g.lite.coins,0);assert.equal(g.liteChooseBuff(roll.buffOptions[0]),false);
  assert.equal(g.liteNext(),false);assert.equal(g.liteRoll(),false);
  assert.equal(g.liteEnterReward(),true);assert.equal(g.liteEnterReward(),false);assert.equal(g.lite.coins,20);
  assert.equal(g.liteNext(),false);assert.equal(g.liteChooseBuff('unknown'),false);
  assert.equal(g.liteChooseBuff(roll.buffOptions[0]),true);assert.equal(g.liteChooseBuff(roll.buffOptions[1]),false);
  assert.equal(g.liteNext(),true);assert.equal(g.stage,1);
});

test('pending and entered rewards serialize without rerolls or double grants', () => {
  const g=make();finishObjective(g);scripted(g,[.4,.4,.4,0]);g.liteRoll();
  const restored=Object.assign(make(),{phase:g.phase,lite:JSON.parse(JSON.stringify(g.lite))});
  assert.equal(restored.lite.roll.total,12);assert.equal(restored.lite.roll.route,'tool');
  assert.equal(restored.lite.tools.shovel,1);assert.equal(restored.liteRoll(),false);
  const options=Array.from(restored.lite.roll.toolOptions),selected=options[0];
  const prior={...restored.lite.tools};
  assert.equal(new Set(options).size,3);assert.equal(restored.liteChooseTool(selected),false);
  assert.equal(restored.liteEnterReward(),true);assert.deepEqual({...restored.lite.tools},prior);
  assert.equal(restored.liteNext(),false);assert.equal(restored.liteChooseTool('unknown'),false);
  const resumed=Object.assign(make(),{phase:restored.phase,lite:JSON.parse(JSON.stringify(restored.lite))});
  assert.deepEqual(Array.from(resumed.lite.roll.toolOptions),options);assert.equal(resumed.liteEnterReward(),false);
  assert.equal(resumed.liteChooseTool(selected),true);assert.equal(resumed.lite.tools[selected],prior[selected]+1);
  assert.equal(resumed.liteChooseTool(options[1]),false);assert.equal(resumed.lite.tools[options[1]],prior[options[1]]);
  const claimed=Object.assign(make(),{phase:resumed.phase,lite:JSON.parse(JSON.stringify(resumed.lite))});
  assert.equal(claimed.liteChooseTool(selected),false);assert.equal(claimed.lite.tools[selected],prior[selected]+1);assert.equal(claimed.liteNext(),true);
});

test('deadlock waits for a usable swap even with no shovel, then resumes original check', () => {
  const g = make();
  g.board = [];
  for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) {
    if ((x !== 0 || y !== 0) && (x !== 1 || y !== 1)) g.board.push({ x, y, id: g.id++, type: 'L' });
  }
  g.lite.tools.shovel = 0;
  g.lite.tools.swap = 1;
  assert.equal(g.checkDeadlock(), false);
  assert.equal(g.phase, 'play');
  g.lite.tools.swap = 0;
  assert.equal(g.checkDeadlock(), true);
  assert.equal(g.phase, 'lost');
});

test('shovel follows the latest actual placement through rotation and keeps older cells', () => {
  const g = make();
  scripted(g, [.99]);
  for(let i=0;i<12;i++) g.move(0,-1);
  g.drop(); settle(g);
  const olderIds = Array.from(g.board, c=>c.id);
  for(let i=0;i<10;i++) g.move(0,-1);
  g.rotatePiece(); g.drop(); settle(g);
  const positions = new Map(g.liteShovelCells().map(c=>[c.id, {x:c.x,y:c.y}]));
  g.beginRotation({lever:1,dir:-1});settle(g);
  const latest = g.liteShovelCells();
  assert.equal(latest.length, 4);
  assert.ok(latest.some(c=>positions.get(c.id).x!==c.x||positions.get(c.id).y!==c.y));
  const before = {score:g.score, drops:g.dropsUsed, tools:g.lite.tools.shovel};
  assert.equal(g.liteUseTool('shovel'), true);
  assert.deepEqual(Array.from(g.board,c=>c.id), olderIds);
  assert.equal(g.score, before.score);
  assert.equal(g.dropsUsed, before.drops);
  assert.equal(g.lite.tools.shovel, before.tools-1);
  g.lite.tools.shovel++;
  assert.equal(g.liteUseTool('shovel'), false);
});

test('shovel removes only surviving last-placement IDs after clearing and save loading', () => {
  const g = make();
  g.drop(); settle(g);
  const latest = Array.from(g.lite.lastPlacementIds);
  assert.ok(latest.length);
  g.board = g.board.filter(c=>c.id!==latest[0]);
  const survivorIds = Array.from(g.board,c=>c.id);
  g.board.push({x:5,y:5,id:g.id++,type:'T'});
  const saved = JSON.parse(JSON.stringify(g));
  const restored = Object.assign(make(), {board:saved.board,lite:saved.lite});
  assert.deepEqual(Array.from(restored.liteShovelCells(),c=>c.id),survivorIds);
  assert.equal(restored.liteUseTool('shovel'),true);
  assert.equal(restored.board.length,1);
  assert.equal(restored.board[0].x,5);
  const h=make();h.board=[{id:99,x:1,y:0,type:'L'}];h.lite.lastPlacementIds=[100];
  assert.equal(h.liteUseTool('shovel'),false);
  assert.equal(h.lite.tools.shovel,1);
});

test('a missed throw clears the shovel target instead of selecting an older placement', () => {
  const g = make();g.drop();settle(g);
  g.active.x=8;g.drop();settle(g);
  assert.ok(g.events.some(e=>e.kind==='miss'));
  assert.equal(g.liteShovelCells().length,0);
  assert.equal(g.liteUseTool('shovel'),false);
});

test('abandoning a piece keeps the drop budget, including the final remaining throw', () => {
  for(const endless of [false,true])for(const finalThrow of [false,true]){
    const g=make();g.endless=endless;
    if(finalThrow)g.dropsUsed=g.dropLimit-1;
    const used=g.dropsUsed,remaining=g.dropsRemaining,lives=g.lives,board=JSON.stringify(g.board);
    g.active.x=8;g.drop();settle(g);
    assert.ok(g.events.some(e=>e.kind==='miss'));
    assert.equal(g.dropsUsed,used);assert.equal(g.dropsRemaining,remaining);
    assert.equal(g.lives,lives-1);assert.equal(JSON.stringify(g.board),board);
    assert.equal(g.phase,'play');assert.ok(g.active);
    g.active={type:'L',color:'L',shape:[[0,0]],x:0,y:1,origin:'ordinary'};
    g.lock();assert.equal(g.dropsUsed,used+1);
  }
  const g=make();g.lives=1;g.active.x=8;g.drop();
  assert.equal(g.phase,'lost');assert.equal(g.dropsUsed,0);
});

test('special properties survive original lock and bonus scores without old material effects', () => {
  const g = make();
  g.active = { type: 'L', color: 'L', shape: [[0, 0]], x: 0, y: 1, origin: 'ordinary', liteEffect: 'bonus' };
  g.lock();
  assert.equal(g.board[0].liteEffect, 'bonus');
  assert.equal(g.board[0].effect, undefined);
  const plain = make().awardCells([{ x: 1, y: 0, type: 'L' }], 'tool');
  const bonus = make().awardCells([{ x: 1, y: 0, type: 'L', liteEffect: 'bonus' }], 'tool');
  assert.equal(bonus.points - plain.points, 5);
  const h = make();
  h.board = [{ x: 1, y: 0, id: h.id++, type: 'T' }];
  h.active = { type: 'L', color: 'L', shape: [[0, 0]], x: 0, y: 1, origin: 'ordinary', liteEffect: 'chameleon' };
  h.board.push({ x: 1, y: 1, id: h.id++, type: 'T' });
  h.lock();
  assert.equal(h.board.find(c => c.liteEffect === 'chameleon').type, 'T');
});

test('all five small levels award dice before victory', () => {
  const g = make();
  for (let stage = 0; stage < 5; stage++) {
    assert.equal(g.stage, stage);
    finishObjective(g);
    scripted(g, [0, 0, .125]);
    assert.ok(g.liteRoll());
    assert.equal(g.liteEnterReward(),true);
    assert.equal(g.liteNext(), true);
  }
  assert.equal(g.phase, 'won');
  assert.equal(g.lite.coins, 25);
});

test('shop respects phase and balance; retry resets run inventory', () => {
  const g = make();
  assert.equal(g.liteBuyOffer(g.lite.roll?.shopOffers?.find(o=>o.kind==='tool')?.slot), false);
  finishObjective(g);
  scripted(g, [0, 0, .125]);
  g.liteRoll();
  assert.equal(g.liteBuyOffer(g.lite.roll?.shopOffers?.find(o=>o.kind==='tool')?.slot), false);
  g.liteEnterReward();
  assert.equal(g.liteBuyOffer(g.lite.roll?.shopOffers?.find(o=>o.kind==='tool')?.slot), true);
  assert.equal(g.lite.coins, 0);
  assert.equal(g.liteBuyOffer(g.lite.roll?.shopOffers?.find(o=>o.kind==='tool')?.slot), false);
  g.phase = 'play';
  g.dropsUsed = g.dropLimit;
  assert.equal(g.checkDropLimit(), true);
  assert.equal(g.phase, 'lost');
  g.reset(42);
  assert.equal(g.phase, 'play');
  assert.equal(g.lives, 3);
  assert.equal(g.lite.coins, 0);
  assert.equal(g.lite.tools.shovel, 1);
  assert.equal(g.lite.buffs.length, 0);
});


test('all dice combinations route by total into exactly one pool, including every boundary', () => {
  for(let a=1;a<=8;a++)for(let b=1;b<=8;b++)for(let c=1;c<=8;c++){
    const g=make();g.phase='checkpoint-complete';scripted(g,[(a-1)/8,(b-1)/8,(c-1)/8,0]);
    const roll=g.liteRoll(),total=a+b+c,expected=total<=10?'shop':total<=13?'tool':total<=16?'buff':'special';
    assert.equal(roll.total,total);assert.equal(roll.route,expected);
    assert.equal(roll.buffOptions.length>0,expected==='buff');
    assert.equal(Object.values(roll.tools).reduce((a,b)=>a+b,0),0);
    assert.equal(roll.toolOptions.length===3,expected==='tool');
    assert.equal(roll.specialOptions.length===3,expected==='special');
    assert.equal(g.liteEnterReward(),true);
    assert.equal(g.liteBuyOffer(g.lite.roll?.shopOffers?.find(o=>o.kind==='tool')?.slot),expected==='shop');
  }
});

test('special destination grants one conversion tool; ordinary spawns stay ordinary', () => {
  const g=make();finishObjective(g);scripted(g,[.9,.9,.9,0]);const roll=g.liteRoll();
  assert.equal(roll.specialOptions.length,3);assert.equal(g.liteChooseSpecial(roll.specialOptions[0]),false);
  g.liteEnterReward();assert.equal(g.liteNext(),false);
  const id=roll.specialOptions[0];assert.equal(g.liteChooseSpecial(id),true);assert.equal(g.liteChooseSpecial(id),false);
  assert.equal(g.lite.tools['block-'+id],1);assert.equal(g.lite.specials.length,0);g.liteNext();
  for(let i=0;i<8;i++){g.active=null;g.spawn();assert.equal(g.active.liteEffect,null);}
  const before=JSON.stringify(g.active.shape);assert.equal(g.liteUseTool('block-'+id),true);
  assert.equal(g.active.liteEffect,id);assert.equal(JSON.stringify(g.active.shape),before);assert.equal(g.lite.tools['block-'+id],0);
});

test('simple scoring buffs feed the original badge and cell-feedback pipeline', () => {
  const g=make();g.lite.buffs=['clear-score','bonus-score'];
  const score=g.awardCells([{id:1,x:1,y:0,type:'L',liteEffect:'bonus'}]);
  assert.ok(score.triggered.includes('clear-score'));
  assert.ok(score.triggered.includes('bonus-score'));
  assert.equal(score.cellFeedback['buff:bonus-score'].length,1);
});


test('lite bonus and buff points count toward the goal; next stage clears its own score', () => {
  const g=make();g.checkpointScore=40;g.lite.buffs=['bonus-score'];
  g.awardCells([{id:99,x:1,y:0,type:'L',liteEffect:'bonus'}],'tool');
  assert.ok(g.checkpointScore>=g.goal);assert.equal(g.completeCheckpoint(),true);
  scripted(g,[0,0,0]);g.liteRoll();g.liteEnterReward();g.liteNext();
  assert.equal(g.checkpointScore,0);assert.equal(g.goal,80);assert.equal(g.completeCheckpoint(),false);
});


test('shop stocks eight saved slots across all eligible categories and sells each slot once', () => {
  const g=make();finishObjective(g);scripted(g,[0,0,0,.2,.4,.7,.1,.8,.5,.3,.9]);
  const roll=g.liteRoll();assert.equal(roll.shopOffers.length,8);
  assert.equal(new Set(roll.shopOffers.map(o=>o.slot)).size,8);
  assert.deepEqual([...new Set(roll.shopOffers.map(o=>o.kind))].sort(),['buff','special','tool']);
  assert.equal(g.liteBuyOffer(roll.shopOffers[0].slot),false);
  g.liteEnterReward();g.lite.coins=100;
  for(const kind of ['tool','buff','special']){
    const item=roll.shopOffers.find(o=>o.kind===kind),before=g.lite.coins,toolCount=g.lite.tools[item.item]||0;
    assert.equal(g.liteBuyOffer(item.slot),true);assert.equal(g.lite.coins,before-item.price);assert.equal(item.sold,true);
    assert.equal(g.liteBuyOffer(item.slot),false);
    assert.ok(kind==='tool'?g.lite.tools[item.item]===toolCount+1:kind==='buff'?g.lite.buffs.includes(item.item):g.lite.tools['block-'+item.item]===1);
  }
  const saved=JSON.parse(JSON.stringify(g.lite)),h=Object.assign(make(),{phase:g.phase,lite:saved});
  assert.equal(JSON.stringify(h.lite.roll.shopOffers),JSON.stringify(roll.shopOffers));
  assert.equal(h.liteBuyOffer(999),false);
  h.lite.coins=0;assert.equal(h.liteBuyOffer(h.lite.roll.shopOffers.find(o=>!o.sold).slot),false);
});

test('shop excludes owned buffs but restocks consumable conversions, and varies between visits', () => {
  const g=make();g.lite.buffs=['extra-moves'];g.lite.tools['block-bonus']=1;
  const stock=g.liteCreateShop();assert.equal(stock.length,8);
  assert.ok(stock.every(o=>o.item!=='extra-moves'));
  const unlocks=stock.filter(o=>o.kind==='buff').map(o=>o.item);assert.equal(new Set(unlocks).size,unlocks.length);
  assert.notEqual(JSON.stringify(stock),JSON.stringify(g.liteCreateShop()));
  g.lite.buffs=['extra-moves','shovel-supply','clear-score','bonus-score'];g.lite.specials=['bonus','chameleon'];
  const exhausted=g.liteCreateShop();assert.equal(exhausted.length,8);assert.ok(exhausted.every(o=>o.kind!=='buff'));
});

test('supply stacks with the move buff, survives saving and resets on the next level', () => {
  const g=make();g.lite.tools.supply=2;g.lite.buffs=['extra-moves'];
  const score=g.score,used=g.dropsUsed;
  assert.equal(g.dropLimit,27);assert.equal(g.liteUseTool('supply'),true);assert.equal(g.dropLimit,30);
  assert.equal(g.liteUseTool('supply'),true);assert.equal(g.dropLimit,33);
  assert.equal(g.liteUseTool('supply'),false);assert.equal(g.score,score);assert.equal(g.dropsUsed,used);
  const saved=JSON.parse(JSON.stringify(g.lite)),h=make();h.lite=saved;assert.equal(h.dropLimit,33);
  finishObjective(g);scripted(g,[0,0,0]);g.liteRoll();g.liteEnterReward();g.liteNext();
  assert.equal(g.lite.extraDrops,0);assert.equal(g.dropLimit,27);
});

test('dye takes the dominant board color and refuses empty or already matching colors', () => {
  const g=make();g.lite.tools.dye=2;
  assert.equal(g.liteUseTool('dye'),false);assert.equal(g.lite.tools.dye,2);
  g.board=[{x:2,y:0,id:g.id++,type:'T'},{x:3,y:0,id:g.id++,type:'T'},{x:4,y:0,id:g.id++,type:'L'}];
  g.active={type:'L',color:'L',shape:[[0,0]],x:0,y:1,origin:'ordinary'};
  const shape=JSON.stringify(g.active.shape),drops=g.dropsUsed,score=g.score;
  assert.equal(g.liteUseTool('dye'),true);assert.equal(g.active.color,'T');assert.equal(g.active.type,'L');
  assert.equal(JSON.stringify(g.active.shape),shape);assert.equal(g.dropsUsed,drops);assert.equal(g.score,score);
  assert.equal(g.liteUseTool('dye'),false);assert.equal(g.lite.tools.dye,1);
  g.lock();assert.equal(g.board.find(c=>c.x===0).type,'T');
});

test('repair restores one miss allowance, caps at three and cannot be used during resolution', () => {
  const g=make();g.lite.tools.repair=2;
  assert.equal(g.liteUseTool('repair'),false);assert.equal(g.lite.tools.repair,2);
  g.lives=2;g.phase='rotating';assert.equal(g.liteUseTool('repair'),false);
  g.phase='play';assert.equal(g.liteUseTool('repair'),true);assert.equal(g.lives,3);
  assert.equal(g.lite.tools.repair,1);assert.equal(g.liteUseTool('repair'),false);
});

test('dice offers three distinct eligible tools; all inventory items can drop from completed rotor turns', () => {
  const ids=Object.keys(make().lite.tools);
  for(const [index,id] of ids.entries()){
    const draw=(index+.1)/ids.length,g=make(),count=g.lite.tools[id];g.phase='checkpoint-complete';scripted(g,[.4,.4,.4,draw]);
    const roll=g.liteRoll();assert.equal(roll.route,'tool');assert.equal(new Set(roll.toolOptions).size,3);
    assert.ok(roll.toolOptions.every(option=>ids.includes(option)));const selected=roll.toolOptions[0],prior=g.lite.tools[selected];
    g.liteEnterReward();assert.equal(g.lite.tools[id],count);g.liteChooseTool(selected);assert.equal(g.lite.tools[selected],prior+1);
    const h=make(),before=h.lite.tools[id];h.board=[{x:1,y:0,id:h.id++,type:'L'}];scripted(h,[0,draw]);
    h.beginRotation({lever:1,dir:-1});h.finishRotation();assert.equal(h.lite.tools[id],before+1);
  }
});

test('unused tools carry across stages and rewards stack; a new run resets inventory', () => {
  const g=make();g.lite.tools.shovel=9;g.lite.tools['block-coin']=4;g.lite.buffs=['shovel-supply'];
  const prior={...g.lite.tools};finishObjective(g);assert.deepEqual({...g.lite.tools},prior);assert.deepEqual(Array.from(g.lite.buffs),['shovel-supply']);
  scripted(g,[.4,.4,.4,.61]);g.liteRoll();g.liteEnterReward();
  const reward=g.lite.roll.toolOptions.find(id=>id!=='shovel');g.liteChooseTool(reward);assert.equal(g.lite.tools[reward],prior[reward]+1);
  assert.equal(g.completeCheckpoint(),false);assert.equal(g.lite.tools[reward],prior[reward]+1);
  g.liteNext();assert.equal(g.lite.tools[reward],prior[reward]+1);assert.equal(g.lite.tools.shovel,10);
  const carried={...g.lite.tools};finishObjective(g);assert.deepEqual({...g.lite.tools},carried);
  g.reset();assert.equal(g.lite.tools.shovel,1);assert.equal(g.lite.tools.swap,1);assert.equal(g.lite.tools['block-coin'],0);
});

test('both choice rewards allow one free refresh and three timed ad refreshes without duplicate grants', () => {
  for(const route of ['buff','special']){
    const g=make();g.phase='checkpoint-complete';scripted(g,route==='buff'?[.5,.5,.5]:[.9,.9,.9]);g.liteRoll();
    const key=route==='buff'?'buffOptions':'specialOptions',choose=id=>route==='buff'?g.liteChooseBuff(id):g.liteChooseSpecial(id);
    assert.equal(g.liteRefreshReward(),false);g.liteEnterReward();
    const before=Array.from(g.lite.roll[key]);assert.equal(before.length,3);assert.equal(g.liteStartRewardAd(1000),false);
    assert.equal(g.liteRefreshReward(),true);assert.ok(g.lite.roll[key].some(id=>!before.includes(id)));assert.equal(g.liteRefreshReward(),false);
    for(let i=0;i<3;i++){
      assert.equal(g.liteStartRewardAd(1000),true);assert.equal(g.liteStartRewardAd(1000),false);
      assert.equal(choose(g.lite.roll[key][0]),false);assert.equal(g.liteFinishRewardAd(2999),false);
      assert.equal(g.liteFinishRewardAd(3000),true);assert.equal(g.liteFinishRewardAd(3001),false);
      assert.equal(g.lite.roll.adRefreshes,2-i);assert.equal(new Set(g.lite.roll[key]).size,3);
    }
    assert.equal(g.liteStartRewardAd(4000),false);assert.equal(choose(g.lite.roll[key][0]),true);assert.equal(choose(g.lite.roll[key][1]),false);
    assert.equal(g.liteRefreshReward(),false);assert.equal(g.liteNext(),true);
  }
});

test('choice timers and refresh quotas survive serialization; full Buff ownership still gives three choices', () => {
  const g=make();g.phase='checkpoint-complete';g.lite.buffs=['extra-moves','shovel-supply','clear-score','bonus-score'];scripted(g,[.5,.5,.5]);g.liteRoll();g.liteEnterReward();
  assert.equal(g.lite.roll.buffOptions.length,3);g.liteRefreshReward();g.liteStartRewardAd(1000);
  const h=make();h.phase=g.phase;h.lite=JSON.parse(JSON.stringify(g.lite));assert.equal(h.liteFinishRewardAd(2999),false);assert.equal(h.liteFinishRewardAd(3000),true);
  assert.equal(h.lite.roll.freeRefreshes,0);assert.equal(h.lite.roll.adRefreshes,2);
  assert.equal(h.liteChooseBuff(h.lite.roll.buffOptions[0]),true);assert.equal(h.lite.buffs.length,4);assert.equal(h.lite.coins,25);
});

test('material conversion preserves shape and position, rejects locked phases and equal material, and survives actual lock', () => {
  for(const id of ['bonus','chameleon','coin','link','pigment']){
    const g=make();g.lite.tools['block-'+id]=2;const before={shape:JSON.stringify(g.active.shape),x:g.active.x,y:g.active.y,used:g.dropsUsed};
    assert.equal(g.liteUseTool('block-'+id),true);assert.equal(g.liteUseTool('block-'+id),false);
    assert.equal(g.lite.tools['block-'+id],1);assert.equal(JSON.stringify(g.active.shape),before.shape);assert.equal(g.active.x,before.x);assert.equal(g.active.y,before.y);assert.equal(g.dropsUsed,before.used);
    g.phase='rotating';assert.equal(g.liteUseTool('block-coin'),false);g.phase='play';g.drop();settle(g);
    assert.ok(g.board.some(c=>c.liteEffect===id));
  }
  const g=make();g.active={type:'L',color:'L',shape:[[0,0]],x:0,y:1};g.board=[{x:2,y:0,id:g.id++,type:'T'}];g.lite.tools['block-pigment']=1;
  g.liteUseTool('block-pigment');assert.equal(g.active.color,'T');
});

test('coin material awards coins and linked stone scores only with a sufficient clear group', () => {
  const cells=Array.from({length:4},(_,i)=>({id:i,x:i,y:0,type:'L'}));
  const base=make().awardCells(cells,'tool'),g=make();cells[0].liteEffect='link';cells[1].liteEffect='coin';
  const score=g.awardCells(cells,'tool');assert.equal(score.points-base.points,6);assert.equal(g.lite.coins,1);
  const one={x:0,y:0,id:1,type:'L'},plain=make().awardCells([one],'tool'),small=make().awardCells([{...one,liteEffect:'link'}],'tool');assert.equal(small.points,plain.points);
});

test('endless keeps native outline variety and budget, continues past five stages, and never enters victory', () => {
  const g=make();g.endless=true;const baseline=new original.Game(42);baseline.endless=true;baseline.outlineSeed=g.outlineSeed;
  const outlines=new Set();
  for(let stage=0;stage<12;stage++){
    g.stage=baseline.stage=stage;g.outline=baseline.outline=null;
    assert.equal(JSON.stringify(g.target.cells),JSON.stringify(baseline.target.cells));assert.equal(g.dropLimit,baseline.dropLimit);
    outlines.add(JSON.stringify(g.target.cells));if(stage>=5)assert.equal(g.goal,baseline.target.goals[0]);
  }
  assert.ok(outlines.size>5);
  g.stage=4;g.phase='play';g.outline=null;g.checkpointScore=g.goal;g.completeCheckpoint();scripted(g,[0,0,0]);g.liteRoll();g.liteEnterReward();assert.equal(g.liteNext(),true);assert.equal(g.stage,5);assert.equal(g.phase,'play');
  g.stage=14;g.outline=null;g.checkpointScore=g.goal;g.completeCheckpoint();scripted(g,[0,0,0]);g.liteRoll();g.liteEnterReward();g.liteNext();assert.equal(g.stage,15);assert.equal(g.phase,'play');
});

test('mixed dice prepare once, roll within each type, and support twelve-point faces',()=>{
  const g=make();g.phase='checkpoint-complete';let draws=[0,.3,.99],i=0;g.liteRandom=()=>draws[i++]??.99;
  g.lite.routeChoices=[...originalRoutes];
  assert.deepEqual(Array.from(g.litePrepareDice()),[4,6,12]);const seedCalls=i;
  g.litePrepareDice();assert.equal(i,seedCalls);
  const r=g.liteRoll();assert.deepEqual(Array.from(r.sides),[4,6,12]);assert.deepEqual(Array.from(r.values),[4,6,12]);
  assert.equal(r.route,'special');assert.equal(g.liteRoll(),false);
});

test('every ordered mixed-dice combination maps all possible results to its balanced dynamic ranges',()=>{
  const kinds=[4,6,8,12],g=make();g.phase='checkpoint-complete';
  g.lite.routeChoices=[...originalRoutes];
  for(const a of kinds)for(const b of kinds)for(const c of kinds){
    const sides=[a,b,c];g.lite.diceSides=sides;const ranges=g.liteRewardRanges(),counts=[0,0,0,0];
    assert.equal(ranges[0].min,3);assert.equal(ranges[3].max,a+b+c);
    for(let i=1;i<4;i++)assert.equal(ranges[i].min,ranges[i-1].max+1);
    for(let x=1;x<=a;x++)for(let y=1;y<=b;y++)for(let z=1;z<=c;z++){
      g.lite.roll=null;let i=0;const values=[(x-1)/a,(y-1)/b,(z-1)/c];g.liteRandom=()=>values[i++]??.1;
      const roll=g.liteRoll(),slot=ranges.findIndex(r=>roll.total>=r.min&&roll.total<=r.max);
      assert.equal(roll.route,ranges[slot].id);assert.equal(roll.total,x+y+z);counts[slot]++;
    }
    assert.ok(counts.every(n=>n>0&&Math.abs(n/(a*b*c)-.25)<=.0625));
  }
});

test('one dice refresh works before or after rolling, persists, never grants, and locks after entry',()=>{
  for(const rolled of [false,true]){
    const g=make();finishObjective(g);g.liteRandom=()=>0;const before=JSON.stringify({coins:g.lite.coins,tools:g.lite.tools,buffs:g.lite.buffs});
    g.lite.routeChoices=[...originalRoutes];
    const previous=Array.from(g.litePrepareDice());if(rolled)g.liteRoll();
    assert.equal(g.liteRefreshDice(),true);assert.equal(g.lite.roll,null);assert.notDeepEqual(Array.from(g.lite.diceSides),previous);
    assert.equal(JSON.stringify({coins:g.lite.coins,tools:g.lite.tools,buffs:g.lite.buffs}),before);
    const resumed=Object.assign(make(),{phase:g.phase,lite:JSON.parse(JSON.stringify(g.lite))});resumed.liteRandom=()=>0;
    assert.equal(resumed.lite.diceRefreshes,0);assert.equal(resumed.liteRefreshDice(),false);
    resumed.liteRoll();resumed.liteEnterReward();assert.equal(resumed.liteRefreshDice(),false);assert.equal(resumed.liteEnterReward(),false);
    assert.equal(resumed.liteNext(),true);assert.equal(resumed.lite.diceRefreshes,1);assert.equal(resumed.lite.diceSides,null);
  }
  const g=make();assert.equal(g.liteRefreshDice(),false);finishObjective(g);g.liteRandom=()=>0;g.liteRoll();g.liteEnterReward();assert.equal(g.liteRefreshDice(),false);
});

const extraReward=(route,stage=0,endless=false)=>{
  const g=make();g.stage=stage;g.endless=endless;g.phase='checkpoint-complete';g.outline=null;
  g.lite.routeChoices=[route,...originalRoutes.filter(id=>id!==route).slice(0,3)];g.lite.diceSides=[8,8,8];
  let draw=0;g.liteRandom=()=>draw++===2?.125:0;g.liteRoll();assert.equal(g.lite.roll.route,route);return g;
};
const restoreReward=g=>Object.assign(make(),{phase:g.phase,stage:g.stage,endless:g.endless,score:g.score,lite:JSON.parse(JSON.stringify(g.lite))});

test('dice combinations recognize mixed types, unordered straights and triples without changing destinations',()=>{
  for(const [sides,values,kind,coins] of [
    [[4,6,12],[3,3,3],'triple',15],[[12,12,12],[12,12,12],'triple',15],
    [[4,6,8],[3,1,2],'straight',8],[[12,12,12],[12,10,11],'straight',8],
    [[4,6,8],[2,2,3],null,0],[[12,12,12],[12,1,2],null,0]]){
    const g=make();g.phase='checkpoint-complete';g.lite.routeChoices=originalRoutes;g.lite.diceSides=sides;
    let n=0;g.liteRandom=()=>n<3?(values[n]-1)/sides[n++]:0;
    const r=g.liteRoll();assert.equal(r.combo?.id??null,kind);assert.equal(g.lite.coins,0);
    assert.equal(r.route,g.liteRewardRanges().find(range=>r.total>=range.min&&r.total<=range.max).id);
    const loaded=restoreReward(g);assert.equal(loaded.liteEnterReward(),true);assert.equal(loaded.lite.coins,5+coins);
    assert.equal(loaded.liteEnterReward(),false);assert.equal(loaded.lite.coins,5+coins);
    if(kind)assert.equal(loaded.lite.roll.combo.claimed,true);
  }
});

test('refresh replaces unclaimed combination bonuses and old rolls receive no retroactive grant',()=>{
  const g=make();g.phase='checkpoint-complete';scripted(g,[0,0,0]);g.liteRoll();assert.equal(g.lite.roll.combo.id,'triple');
  assert.equal(g.liteRefreshDice(),true);assert.equal(g.lite.roll,null);assert.equal(g.lite.coins,0);
  scripted(g,[0,0,.125]);g.liteRoll();assert.equal(g.lite.roll.combo,null);g.liteEnterReward();assert.equal(g.lite.coins,5);
  const old=extraReward('shop');delete old.lite.roll.combo;const loaded=restoreReward(old);loaded.liteEnterReward();assert.equal(loaded.lite.coins,5);
});

test('each checkpoint saves four distinct destinations; refreshing dice keeps them and final normal stage excludes rest',()=>{
  const seen=new Set();
  for(let seed=0;seed<100;seed++){
    const g=new Game(Math.imul(seed,2654435761)),before=g.lite.seed;g.phase='checkpoint-complete';
    const choices=Array.from(g.litePrepareRoutes());choices.forEach(id=>seen.add(id));
    assert.equal(choices.length,4);assert.equal(new Set(choices).size,4);assert.notEqual(g.lite.seed,before);
    assert.ok([2,3].includes(choices.filter(id=>originalRoutes.includes(id)).length));
    const seedAfter=g.lite.seed;assert.deepEqual(Array.from(g.litePrepareRoutes()),choices);assert.equal(g.lite.seed,seedAfter);
    g.litePrepareDice();g.liteRoll();assert.deepEqual(Array.from(g.lite.roll.routes),choices);
    assert.equal(g.liteRefreshDice(),true);assert.deepEqual(Array.from(g.lite.routeChoices),choices);
    const h=restoreReward(g);assert.deepEqual(Array.from(h.litePrepareRoutes()),choices);
    const final=new Game(seed);final.stage=4;assert.ok(!final.litePrepareRoutes().includes('rest'));
  }
  assert.equal(seen.size,8);
  const g=extraReward('shop');g.liteEnterReward();g.liteNext();assert.equal(g.lite.routeChoices,null);
  g.reset();assert.equal(g.lite.routeChoices,null);
});

test('exchange trades one inventory item once, rejects invalid choices, persists, and allows an empty-inventory skip',()=>{
  const g=extraReward('exchange'),r=g.lite.roll,receive=r.exchangeOptions.find(id=>id!=='shovel');
  assert.equal(new Set(r.exchangeOptions).size,3);assert.equal(g.liteExchange('shovel',receive),false);
  g.liteEnterReward();assert.equal(g.liteNext(),false);
  const before=JSON.stringify(g.lite.tools);
  for(const [give,get] of [['unknown',receive],['supply',receive],['shovel','unknown'],[receive,receive]])assert.equal(g.liteExchange(give,get),false);
  assert.equal(JSON.stringify(g.lite.tools),before);
  const h=restoreReward(g),prior=h.lite.tools[receive];assert.equal(h.liteExchange('shovel',receive),true);
  assert.equal(h.lite.tools.shovel,0);assert.equal(h.lite.tools[receive],prior+1);assert.deepEqual({...h.lite.roll.chosenExchange},{give:'shovel',receive});
  assert.ok(h.events.some(e=>e.kind==='lite-extra-tool'&&e.id===receive));
  assert.equal(h.liteExchange('swap',receive),false);assert.equal(h.liteSkipExchange(),false);
  const saved=restoreReward(h);assert.equal(saved.liteExchange('swap',receive),false);assert.equal(saved.liteNext(),true);assert.equal(saved.lite.tools[receive],prior+1);
  const empty=extraReward('exchange');for(const id of Object.keys(empty.lite.tools))empty.lite.tools[id]=0;
  empty.liteEnterReward();assert.equal(empty.liteSkipExchange(),true);assert.equal(empty.liteSkipExchange(),false);assert.equal(empty.liteNext(),true);
});

test('gamble grants only collected pot, caps at two attempts and losing never spends stored coins',()=>{
  const g=extraReward('gamble');g.lite.coins=40;
  assert.equal(g.liteGamble(),false);assert.equal(g.liteCollectGamble(),false);g.liteEnterReward();assert.equal(g.lite.coins,45);
  assert.equal(g.liteNext(),false);g.liteRandom=()=>.99;
  assert.equal(g.liteGamble(),true);assert.equal(g.lite.roll.gamble.lastDie,6);assert.equal(g.lite.roll.gamble.pot,10);assert.equal(g.lite.coins,45);
  const h=restoreReward(g);h.liteRandom=()=>.5;assert.equal(h.liteGamble(),true);assert.equal(h.lite.roll.gamble.lastDie,4);assert.equal(h.lite.roll.gamble.pot,20);
  assert.equal(h.liteGamble(),false);assert.equal(h.liteCollectGamble(),true);assert.equal(h.lite.coins,65);
  const saved=restoreReward(h);assert.equal(saved.liteCollectGamble(),false);assert.equal(saved.liteGamble(),false);assert.equal(saved.liteNext(),true);
  const lost=extraReward('gamble');lost.lite.coins=40;lost.liteEnterReward();lost.liteRandom=()=>.99;lost.liteGamble();lost.liteRandom=()=>0;
  assert.equal(lost.liteGamble(),true);assert.equal(lost.lite.roll.gamble.lost,true);assert.equal(lost.lite.roll.gamble.pot,0);assert.equal(lost.lite.coins,45);
  assert.equal(lost.liteGamble(),false);assert.equal(lost.liteCollectGamble(),true);assert.equal(lost.lite.coins,45);
  const keep=extraReward('gamble');keep.liteEnterReward();assert.equal(keep.liteCollectGamble(),true);assert.equal(keep.lite.coins,10);assert.equal(keep.lite.roll.gamble.attempts,0);
});

test('rest credits exactly the next goal once, skips it, retains inventory, and preserves preview state',()=>{
  const g=extraReward('rest');g.score=100;g.lite.tools['block-coin']=2;const outline=g.target;
  const before=JSON.stringify({stage:g.stage,outline:g.outline,score:g.score});
  assert.deepEqual({...g.liteNextStageInfo()},{stage:1,won:false,goal:80});
  assert.equal(JSON.stringify({stage:g.stage,outline:g.outline,score:g.score}),before);assert.equal(g.liteRest(),false);
  assert.equal(g.lite.roll.rest.score,80);g.liteEnterReward();assert.equal(g.liteNext(),false);
  assert.equal(g.liteRest(),true);assert.equal(g.score,180);assert.equal(g.liteRest(),false);
  assert.equal(g.lite.coins,10);assert.equal(g.lite.buffs.length,1);assert.equal(g.lite.buffs[0],g.lite.roll.rest.buff);
  assert.deepEqual({...g.liteNextStageInfo()},{stage:2,won:false,goal:120});
  const h=restoreReward(g);assert.equal(h.liteRest(),false);assert.equal(h.liteNext(),true);assert.equal(h.stage,2);assert.equal(h.goal,120);assert.equal(h.score,180);assert.equal(h.checkpointScore,0);assert.equal(h.lite.tools['block-coin'],2);
});

test('rest saves its random buff, substitutes coins when all buffs are owned, and never double grants',()=>{
  const g=extraReward('rest'),chosen=g.lite.roll.rest.buff;g.liteEnterReward();const h=restoreReward(g);
  h.liteRandom=()=>{throw new Error('Claim must not reroll');};assert.equal(h.liteRest(),true);assert.equal(h.lite.buffs[0],chosen);assert.equal(h.lite.coins,10);assert.equal(h.liteRest(),false);
  const full=make();full.lite.buffs=['extra-moves','shovel-supply','clear-score','bonus-score'];full.phase='checkpoint-complete';full.lite.routeChoices=['rest','shop','tool','buff'];full.lite.diceSides=[8,8,8];full.liteRandom=()=>0;
  full.liteRoll();assert.equal(full.lite.roll.rest.buff,null);assert.equal(full.lite.roll.rest.convertedCoins,5);full.liteEnterReward();assert.equal(full.liteRest(),true);assert.equal(full.lite.coins,30);assert.equal(full.lite.buffs.length,4);
});

test('rest skipping the final normal stage wins once, while endless skips use native goal generation',()=>{
  const g=extraReward('rest',3);g.liteEnterReward();assert.equal(g.lite.roll.rest.score,240);g.liteRest();
  assert.deepEqual({...g.liteNextStageInfo()},{stage:4,won:true,goal:null});assert.equal(g.liteNext(),true);assert.equal(g.stage,4);assert.equal(g.phase,'won');assert.equal(g.liteNext(),false);assert.equal(g.score,240);
  const h=extraReward('rest',7,true),baseline=make();baseline.endless=true;baseline.outlineSeed=h.outlineSeed;baseline.stage=8;baseline.outline=null;
  assert.equal(h.lite.roll.rest.score,baseline.goal);const credited=baseline.goal;h.liteEnterReward();h.liteRest();
  baseline.stage=9;baseline.outline=null;assert.deepEqual({...h.liteNextStageInfo()},{stage:9,won:false,goal:baseline.goal});
  assert.equal(h.liteNext(),true);assert.equal(h.stage,9);assert.equal(h.phase,'play');assert.equal(h.goal,baseline.goal);assert.equal(h.score,credited);
});

test('jackpot lets players choose three distinct catalogue rewards atomically and persists claims',()=>{
  const g=extraReward('jackpot'),keys=['coin','tool:block-bonus','buff:clear-score'];
  assert.equal(g.lite.roll.jackpotOptions.length,15);assert.equal(g.liteClaimJackpot(keys),false);g.liteEnterReward();
  const before=JSON.stringify({coins:g.lite.coins,tools:g.lite.tools,buffs:g.lite.buffs});
  for(const invalid of [[],['coin'],['coin','coin','tool:shovel'],['coin','tool:shovel','invalid'],null])assert.equal(g.liteClaimJackpot(invalid),false);
  assert.equal(JSON.stringify({coins:g.lite.coins,tools:g.lite.tools,buffs:g.lite.buffs}),before);
  const h=restoreReward(g);assert.equal(h.liteClaimJackpot(keys),true);assert.equal(h.lite.coins,10);assert.equal(h.lite.tools['block-bonus'],1);assert.ok(h.lite.buffs.includes('clear-score'));assert.deepEqual(Array.from(h.lite.roll.jackpotChosen),keys);
  assert.ok(h.events.some(e=>e.kind==='lite-extra-tool'&&e.id==='block-bonus'));assert.ok(h.events.some(e=>e.kind==='lite-buff'&&e.id==='clear-score'));
  const saved=restoreReward(h);assert.equal(saved.liteClaimJackpot(keys),false);assert.equal(saved.liteNext(),true);assert.equal(saved.lite.tools['block-bonus'],1);
  const owned=extraReward('jackpot');owned.liteEnterReward();owned.lite.buffs.push('clear-score');assert.equal(owned.liteClaimJackpot(keys),false);assert.equal(owned.lite.coins,5);assert.equal(owned.lite.tools['block-bonus'],0);
  const full=make();full.lite.buffs=['extra-moves','shovel-supply','clear-score','bonus-score'];full.phase='checkpoint-complete';full.lite.routeChoices=['jackpot','shop','tool','buff'];full.lite.diceSides=[8,8,8];full.liteRandom=()=>0;full.liteRoll();assert.equal(full.lite.roll.jackpotOptions.length,11);full.liteEnterReward();assert.equal(full.liteClaimJackpot(['tool:shovel','tool:swap','tool:repair']),true);
});
