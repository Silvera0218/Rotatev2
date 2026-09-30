import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

export function loadEngine(configPath, sourcePath='index.html') {
  const html=fs.readFileSync(sourcePath,'utf8');
  const start=html.indexOf('/* ROTATION_CONFIG_BEGIN */');
  const end=html.indexOf('var ho=0',start);
  if(start<0||end<0)throw Error('Game engine markers missing');
  let source=html.slice(start,end);
  const config=JSON.parse(source.match(/var ROTATION_CONFIG = (.*);/)[1]);
  if(configPath)source=source.replace(/var ROTATION_CONFIG = .*;/,'var ROTATION_CONFIG = '+fs.readFileSync(configPath,'utf8').trim()+';');
  source+='\nRotationMechanics.installModel(e9,ft,nt.energyCap);C5=RotationMechanics.makeScorer(C5);globalThis.api={Game:e9,clone:L5,score:C5,buffDescription:w5,config:ROTATION_CONFIG,mechanics:RotationMechanics,shapes:et,buffs:Ze,cards:Lt,geometry:Nn,drawRewards:Q9};';
  const context=vm.createContext({console,structuredClone,performance});
  vm.runInContext(source,context,{timeout:10000});
  return {...context.api,source,sourceHash:crypto.createHash('sha256').update(html).digest('hex'),baseline:config};
}
export function settle(g){for(let i=0;i<100;i++){if(g.phase==='rotating')g.finishRotation();else if(g.phase==='clearing')g.finishClear();else if(g.phase==='settling')g.finishSettlement();else return;}throw Error('phase loop limit');}

function landings(g){
 const shapes=[g.active.shape];for(let i=1;i<4;i++)shapes.push(shapes[i-1].map(([x,y])=>[y,-x]));
 const occupied=new Set(['0,0',...g.board.map(c=>`${c.x},${c.y}`)]);
 const valid=p=>shapes[p.r].every(([x,y])=>{x+=p.x;y+=p.y;return x>=-12&&x<=12&&y>=-12&&y<=16&&!occupied.has(`${x},${y}`);});
 const queue=[{x:g.active.x,y:g.active.y,r:0,path:[]}],seen=new Set(),out=[],lands=new Set();
 for(let i=0;i<queue.length;i++){
  const p=queue[i],key=`${p.x},${p.y},${p.r}`;if(seen.has(key))continue;seen.add(key);
  if(!valid({...p,y:p.y-1})) {const cells=shapes[p.r].map(([x,y])=>`${x+p.x},${y+p.y}`).sort().join(';');if(!lands.has(cells)){lands.add(cells);out.push(p);}}
  for(const [dx,dy,action] of [[-1,0,'left'],[1,0,'right'],[0,-1,'down']]){const q={...p,x:p.x+dx,y:p.y+dy};if(valid(q)&&!seen.has(`${q.x},${q.y},${q.r}`))queue.push({...q,path:[...p.path,action]});}
  for(const dx of [0,-1,1,-2,2]){const q={...p,x:p.x+dx,r:(p.r+1)%4};if(valid(q)){if(!seen.has(`${q.x},${q.y},${q.r}`))queue.push({...q,path:[...p.path,'rotate']});break;}}
 }
 return out;
}
function execute(g,path){for(const a of path){const ok=a.startsWith('ability:')?g.useAbility(a.slice(8)):a.startsWith('reserve:')?g.selectInsertion(a.slice(8)):a==='rotate'?g.rotatePiece():g.move(a==='left'?-1:a==='right'?1:0,a==='down'?-1:0);if(!ok)throw Error('Illegal replay action '+a);}g.drop();settle(g);}
function previewClone(api,g){const h=api.clone(g);h.checkDeadlock=()=>false;h.events=[];h.scoreSeed=0x51a7e001;h.scoreRandom=()=>0.5;return h;}
// A reserved tool spends energy before it appears. Confirm that its next turn
// has a surviving action using independent fixed-RNG clones. Keep reservations
// when dice scoring makes survival uncertain rather than inspect hidden RNG.
function insertionCanSurvive(api,g){
 // With rescue energy or an active skill, keep the existing policy. The guard
 // targets proven forced tool deaths; it does not expand multi-turn planning.
 if(g.energy>0||g.abilities.some(a=>a.enabled&&!a.action.startsWith('preview:')&&a.action!=='info'))return true;
 const variants=[g];
 for(const ability of g.abilities.filter(a=>a.enabled&&!a.action.startsWith('preview:')&&a.action!=='info')){const h=api.clone(g);if(h.useAbility(ability.action))variants.push(h);}
 for(const variant of variants)for(const pose of landings(variant)){
  const h=api.clone(variant);h.events=[];execute(h,pose.path);if(h.phase!=='lost')return true;
 }
 return false;
}
function rank(g,before,policy='greedy'){
 if(g.phase==='lost')return -1e7;
 const filled=g.filled,area=g.target.cells.length;
 const cells=new Set(['0,0',...g.board.map(c=>`${c.x},${c.y}`)]);
 let holes=0,depth=0;
 for(const c of g.target.cells)if(!cells.has(`${c.x},${c.y}`)){let neighbors=0;for(const [x,y]of [[1,0],[-1,0],[0,1],[0,-1]])if(cells.has(`${c.x+x},${c.y+y}`))neighbors++;if(neighbors>=3)holes+=neighbors-2;}
 for(const c of g.board)depth+=Math.abs(c.x)+Math.abs(c.y);
 if(policy==='tactical'){
  // Reserve approach space in every orientation, since the board rotates.
  let pressure=0;for(const c of g.board){const radius=Math.max(Math.abs(c.x),Math.abs(c.y));pressure+=Math.max(0,radius-6)**2;}
  let distance=0;for(const c of g.target.cells)if(!cells.has(`${c.x},${c.y}`))distance+=Math.min(...g.board.map(b=>Math.abs(b.x-c.x)+Math.abs(b.y-c.y)),Math.abs(c.x)+Math.abs(c.y));
  return Math.min(180,(g.score-before.score)/Math.max(24,before.goal)*180)+filled*15+filled/area*30-g.board.length*5-depth*.6-holes*65-pressure*9-distance*3+(g.lives-before.lives)*400+(g.phase.includes('complete')?700:0);
 }
 return (g.score-before.score)*2+filled*12+filled/area*30-g.board.length*5-depth*.4-holes*25+(g.lives-before.lives)*300+(g.phase.includes('complete')?500:0);
}
export function chooseMove(api,g,policy='planner',random=()=>.5){
 const options=[];
 const variants=[{game:g,path:[]}];
 if(['capable','tactical'].includes(policy))for(const ability of g.abilities.filter(a=>a.enabled&&!a.action.startsWith('preview:')&&a.action!=='info')){const h=api.clone(g);if(h.useAbility(ability.action))variants.push({game:h,path:['ability:'+ability.action]});}
 for(const variant of variants)for(const pose of landings(variant.game)){
  const h=previewClone(api,variant.game);
  const tool=policy==='tactical'&&g.active?.origin!=='inserted'?tacticalTool(variant.game):null;
  const path=[...pose.path,...tool?['reserve:'+tool]:[]];
  execute(h,path);options.push({path:[...variant.path,...path],value:rank(h,g,policy),preview:h});
 }
 options.sort((a,b)=>b.value-a.value);
 if(policy==='planner')for(const option of options.slice(0,4))if(option.preview.phase==='play'&&option.preview.active){
  let next=-1e7;for(const pose of landings(option.preview)){const h=previewClone(api,option.preview);execute(h,pose.path);next=Math.max(next,rank(h,option.preview));}option.value+=next*.85;
 }
 options.sort((a,b)=>b.value-a.value);
 // All committed turns keep the game's complete deadlock and failure checks.
 for(const option of (policy==='tactical'?options:options.slice(0,policy==='casual'?1:6))){
  const h=api.clone(g);h.events=[];h.scoreSeed=0x51a7e001;h.scoreRandom=()=>0.5;execute(h,option.path);if(h.phase==='lost')continue;
  if(policy==='tactical'&&!g.pixelCards.dice&&option.path.some(a=>a.startsWith('reserve:'))){
   const exact=api.clone(g);exact.events=[];exact.scoreSeed=0x51a7e001;exact.scoreRandom=()=>0.5;execute(exact,option.path);
   if(exact.phase==='play'&&exact.active?.origin==='inserted'&&!insertionCanSurvive(api,exact)){
    const failedTool=exact.active.effect;
    for(const id of g.specialBlocks.filter(id=>id!==failedTool&&clearingTools.has(id)&&g.energy>=g.insertionCost(id))){
     const path=option.path.map(a=>a.startsWith('reserve:')?'reserve:'+id:a),alternative=api.clone(g);alternative.events=[];alternative.scoreSeed=0x51a7e001;alternative.scoreRandom=()=>0.5;
     try{execute(alternative,path)}catch(error){if(error.message==='Illegal replay action reserve:'+id)continue;throw error;}
     if(alternative.phase!=='lost'&&(alternative.phase!=='play'||alternative.active?.origin!=='inserted'||insertionCanSurvive(api,alternative)))return {...option,path,safetyIntervention:'replace-unsafe-reservation:'+id};
    }
    const path=option.path.filter(a=>!a.startsWith('reserve:')),alternative=api.clone(g);alternative.events=[];execute(alternative,path);
    if(alternative.phase!=='lost')return {...option,path,safetyIntervention:'skip-unsafe-reservation'};
    continue;
   }
  }
  return option;
 }
 return options[0];
}
const priority={opening_act:95,spare_change:90,core_band:85,inner_weight:80,exact_four:75,cascade_echo:72,joinery_memory:70,star:100,crystal:95,stitch:92,drill:90,bomb:80,refract:75,cross_lens:100,chain_spectrum:100,chromatic_lattice:95,frontier_light:90,reclaimed_light:85,turning_prism:85,scrapbook:80,echo_plate:75,encore:74,minimal:70};
const clearingTools=new Set(['drill','row','column','cross','bomb','burst','diagonal','ring','flood','trim','pack']);
const tacticalPriority={...priority,drill:115,stitch:105,row:110,column:108,bomb:108,pack:102,burst:100,cross:106,diagonal:100,ring:96,flood:90,trim:100,star:70,crystal:68,refract:65,brake:90,relay:90,mirror:85,frontier:85};
function tacticalTool(g){
 const occupied=new Set(['0,0',...g.board.map(c=>`${c.x},${c.y}`)]);
 const holes=g.target.cells.filter(c=>!occupied.has(`${c.x},${c.y}`)&&[[1,0],[-1,0],[0,1],[0,-1]].filter(([x,y])=>occupied.has(`${c.x+x},${c.y+y}`)).length>=3).length;
 const high=g.board.some(c=>Math.max(Math.abs(c.x),Math.abs(c.y))>=7);
 const needClear=high||g.board.length>g.target.cells.length+4;
 const available=g.specialBlocks.filter(id=>g.energy>=g.insertionCost(id));
 const scores=available.map(id=>({id,value:id==='stitch'?(holes?160:0):clearingTools.has(id)?(needClear?120:35)+(tacticalPriority[id]||50)/10:['star','crystal','refract','gilded'].includes(id)?(g.filled>=g.target.cells.length-8?45:0):0})).sort((a,b)=>b.value-a.value);
 return scores[0]?.value>0?scores[0].id:null;
}
export function runGame(api,seed=1,policy='planner',maxMoves=500,options={}){
 const shapeSeed=options.shapeSeed??42,rotor=options.rotor??'differential';
 const g=new api.Game(shapeSeed);g.reset(shapeSeed,seed);g.chooseRotor(rotor);
 let state=seed>>>0;const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
 const log=[],clears=[],checkpoints=[],acquired=[];
 const award=g.awardCells;g.awardCells=function(...args){const old=this.score;const result=award.apply(this,args);clears.push({stage:this.stage+1,checkpoint:this.checkpoint+1,source:args[1]||'outline',points:this.score-old,chain:this.chain,synergy:result.synergyMultiplier??1,triggered:result.synergyTriggers??[],native:result.contentOutcome?.nativeScore});return result;};
 let moves=0;
 while(!['lost','won'].includes(g.phase)&&(moves<maxMoves||g.phase.includes('complete'))){
  settle(g);
  if(g.phase.includes('complete')){
   checkpoints.push({stage:g.stage+1,checkpoint:g.checkpoint+1,score:g.checkpointScore,goal:g.goal,drops:g.dropsUsed,limit:g.dropLimit});g.openGift();
   const priorities=policy==='tactical'?tacticalPriority:priority;
   if(policy==='tactical'&&g.rewardKind==='block'&&!g.specialBlocks.some(id=>clearingTools.has(id))&&!g.rewardChoices.some(id=>clearingTools.has(id))&&g.canRerollRewards)g.rerollRewards();
   const choices=g.rewardChoices.map(id=>({id,value:(priorities[id]||50)+random()*30})).sort((a,b)=>b.value-a.value);
   let id=choices[0]?.id??null;
   const owned=g.rewardKind==='pixel'?Object.keys(g.pixelCards):g.specialBlocks;
   let replace=id&&g.giftReplacementNeeded(id)?[...owned].sort((a,b)=>(priorities[a]||50)-(priorities[b]||50))[0]:null;
   if(policy==='tactical'&&replace&&(priorities[id]||50)<(priorities[replace]||50)&&g.canSkipGift){id=null;replace=null;}
   const kind=g.rewardKind;if(!g.advanceStage(id,replace,policy==='tactical'))throw Error('Reward selection failed');acquired.push({id,kind,replace});continue;
  }
  if(g.phase!=='play')throw Error('Unexpected phase '+g.phase);
  if(!g.stageCommitted)g.beginStage();if(g.phase!=='play')continue;
  // Reserve an affordable tool for the next spawn, as the real UI does.
  if(!g.insertion&&g.active?.origin!=='inserted'){
   if(policy!=='tactical')for(const id of [...g.specialBlocks].sort((a,b)=>(priority[b]||50)-(priority[a]||50)))if(g.energy>=g.insertionCost(id)&&g.selectInsertion(id))break;
  }
  const recorded=options.resume?.log[moves];
  const choice=recorded?{path:recorded.path}:chooseMove(api,g,policy,random);if(!choice)throw Error('No legal move');
  const turn={move:moves,stage:g.stage+1,checkpoint:g.checkpoint+1,shape:g.active.type,effect:g.active.effect,energy:g.energy,insertion:g.insertion?.piece.effect,path:choice.path};
  if(choice.safetyIntervention)turn.safetyIntervention=choice.safetyIntervention;
  g.events=[];execute(g,choice.path);turn.score=g.score;turn.phase=g.phase;turn.events=g.events.map(e=>({kind:e.kind,points:e.points,stage:e.stage,checkpoint:e.checkpoint}));log.push(turn);moves++;
  if(recorded&&(recorded.score!==g.score||recorded.phase!==g.phase))throw Error(`Replay mismatch at move ${moves}`);
  if(moves%20===0)console.log(JSON.stringify({progress:true,seed,moves,stage:g.stage+1,checkpoint:g.checkpoint+1,score:g.score,board:g.board.length}));
 }
 return {seed,shapeSeed,policySeed:seed,initialScoreSeed:(shapeSeed^1831565813)>>>0,rotor,policy,phase:g.phase,censored:!['lost','won'].includes(g.phase),stage:g.stage+1,checkpoint:g.checkpoint+1,reason:g.reason,score:g.score,moves,finalState:{goal:g.goal,checkpointScore:g.checkpointScore,dropsUsed:g.dropsUsed,dropLimit:g.dropLimit,lives:g.lives,energy:g.energy,targetCells:g.target.cells.length,boardCells:g.board.length,upgrades:g.upgrades,cards:g.pixelCards,tools:g.specialBlocks,build:g.build},checkpoints,clears,acquired,log};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),get=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
 const api=loadEngine(get('--config',null),get('--source','index.html')),count=Number(get('--runs',1)),start=Number(get('--seed',1)),policy=get('--policy','planner'),out=get('--out','.numeric-work/simulation.json');
 const resumePath=get('--resume',null),prior=resumePath?JSON.parse(fs.readFileSync(resumePath,'utf8')):null;
 if(prior&&(prior.sourceHash!==api.sourceHash||JSON.stringify(prior.config)!==JSON.stringify(api.config)||prior.policy!==policy))throw Error('Resume requires the same game source, config and policy');
 if(prior&&prior.runs.some(r=>(args.includes('--shape-seed')&&r.shapeSeed!==Number(get('--shape-seed',42)))||(args.includes('--rotor')&&(r.rotor??'differential')!==get('--rotor','differential'))))throw Error('Resume cannot change shape seed or rotor');
 const runs=[],simulatorHash=crypto.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex');for(let i=0;i<(prior?.runs.length??count);i++){const t=performance.now();const old=prior?.runs[i];const options={rotor:old?.rotor??get('--rotor','differential'),shapeSeed:old?.shapeSeed??Number(get('--shape-seed',42)),resume:old};const r=old&&!old.censored?old:runGame(api,old?.seed??start+i,policy,Number(get('--max-moves',500)),options);runs.push(r);console.log(JSON.stringify({seed:r.seed,phase:r.phase,stage:r.stage,checkpoint:r.checkpoint,score:r.score,moves:r.moves,reason:r.reason,seconds:(performance.now()-t)/1000}));fs.mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});fs.writeFileSync(out,JSON.stringify({sourceHash:api.sourceHash,simulatorHash,config:api.config,policy,priorSimulatorHash:prior?.simulatorHash,runs},null,2));}
}
