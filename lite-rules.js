/* Lightweight rules layered on the original ROTATION model. */
(function (root) {
  'use strict';
  const BUFFS = [
    { id: 'extra-moves', name: '多投几次', description: '后续每关增加 3 次投放。' },
    { id: 'shovel-supply', name: '铲子补给', description: '后续每关开始获得 1 把铲子。' },
    { id: 'clear-score', name: '消除奖励', description: '每次填满轮廓额外获得 20 分。' },
    { id: 'bonus-score', name: '星光奖励', description: '加分格被消除时，每格再加 5 分。' }
  ];
  const SPECIALS = [
    { id:'bonus',name:'加分块',description:'消除时，每格额外获得 5 分。' },
    { id:'chameleon',name:'随色块',description:'落位时，跟随相邻方块最多的颜色。' },
    { id:'coin',name:'金币块',description:'消除时，每格获得 1 金币。' },
    { id:'link',name:'连携块',description:'与至少 4 格一起消除时，每格额外获得 6 分。' },
    { id:'pigment',name:'取色块',description:'改造时，变为棋盘上最多的颜色。' }
  ];
  const RULES = Object.freeze({
    levels: 5, scoreGoals: [45, 80, 120, 180, 240], diceTypes:[4,6,8,12], diceRouteVersion:root.LITE_DICE_ROUTES.design_version,
    rewardMix:{twoNewChance:1/3,jackpotInclusionChance:0.08},
    dropLimit: 24, rotorDropChance: 0.06,
    coinReward: 5, clearCoins: 5, toolPrice: 5, shopSlots: 8, bonusPerCell: 5, buffs: BUFFS,
    tools: [
      { id: 'shovel', name: '铲子', description: '铲除上一次投放仍留在棋盘上的方块。' },
      { id: 'swap', name: '换块', description: '把当前落块换成预告中的下一块。' },
      { id: 'supply', name: '补给箱', description: '本关增加 3 次投放机会。' },
      { id: 'dye', name: '调色瓶', description: '将当前落块染成棋盘上最多的颜色。' },
      { id: 'repair', name: '修补胶带', description: '恢复 1 次落空容错，最多 3 次。' },
      ...SPECIALS.map(block=>({id:'block-'+block.id,name:block.name,blockEffect:block.id,description:'将当前下落块改造为'+block.name+'。'+block.description}))
    ],
    specials: SPECIALS,
    rewardRoutes: [{ min: 3, max: 10, id: 'shop', name: '商店' }, { min: 11, max: 13, id: 'tool', name: '道具补给' }, { min: 14, max: 16, id: 'buff', name: 'Buff 选择' }, { min: 17, max: 24, id: 'special', name: '方块改造' }, {id:'exchange',name:'置换工坊'}, {id:'gamble',name:'幸运赌桌'}, {id:'rest',name:'休息站'}, {id:'jackpot',name:'大成功'}]
  });
  root.ROTATION_LITE = RULES;

  root.installRotationLite = function ({ Game }) {
    const p = Game.prototype;
    if (p.rotationLiteInstalled) return;
    Object.defineProperty(p, 'rotationLiteInstalled', { value: true });
    const original = {};
    for (const key of ['reset', 'spawn', 'cells', 'lock', 'finishRotation', 'awardCells',
      'completeCheckpoint', 'checkDeadlock']) original[key] = p[key];
    const originalTarget = Object.getOwnPropertyDescriptor(p, 'target').get;
    const originalDropLimit = Object.getOwnPropertyDescriptor(p, 'dropLimit').get;
    const randomTool = game => RULES.tools[Math.floor(game.liteRandom() * RULES.tools.length)].id;
    const emptyTools = () => Object.fromEntries(RULES.tools.map(tool => [tool.id, 0]));
    const hasBuff = (game, id) => game.lite?.buffs.includes(id);
    const rewardPhase = game => game.phase === 'checkpoint-complete';

    p.liteRandom = function () {
      this.lite.seed = (Math.imul(this.lite.seed, 1664525) + 1013904223) >>> 0;
      return this.lite.seed / 4294967296;
    };
    p.reset = function (shapeSeed = 42, rewardSeed = shapeSeed) {
      this.lite = {
        coins: 0, tools: { ...emptyTools(), shovel: 1, swap: 1 }, extraDrops: 0, buffs: [], specials: [], specialToolsMigrated:true, lastPlacementIds: [], clears: 0,
        roll: null, routeChoices:null, diceSides:null, diceRefreshes:1, seed: (rewardSeed ^ 0x6a09e667) >>> 0
      };
      const result = original.reset.call(this, shapeSeed, rewardSeed);
      this.pixelCards = {};
      this.specialBlocks = [];
      this.unlockedBlocks = [];
      this.upgrades = { base: 0, multiplier: 0 };
      this.insertion = null;
      this.energy = 0;
      this.roundOffers = null;
      this.stageCommitted = true;
      return result;
    };
    Object.defineProperty(p, 'target', { configurable: true, get() {
      return originalTarget.call(this);
    } });
    Object.defineProperty(p, 'goal', { configurable: true, get() { return RULES.scoreGoals[this.stage] ?? this.target.goals[0]; } });
    Object.defineProperty(p, 'dropLimit', { configurable: true, get() {
      return (this.endless?originalDropLimit.call(this):RULES.dropLimit) + (hasBuff(this, 'extra-moves') ? 3 : 0) + (this.lite?.extraDrops || 0);
    } });
    Object.defineProperty(p, 'canRevive', { configurable: true, get() { return false; } });
    p.expandTarget = () => false;
    p.prepareStageOffers = function () { this.roundOffers = null; };
    p.drawSpecial = () => null;
    p.selectInsertion = () => false;
    p.chooseRotor = () => false;
    p.useAbility = () => false;
    p.openRewards = function () {
      this.rewardChoices = [];
      this.rewardKind = null;
      this.giftOpened = false;
    };

    p.spawn = function (...args) {
      const old = this.active;
      const result = original.spawn.apply(this, args);
      if (this.active && this.active !== old && this.lite) {
        this.active.liteEffect = null;
        this.lite.nextEffect = null;
      }
      return result;
    };
    p.cells = function (piece = this.active) {
      return original.cells.call(this, piece).map(cell => ({ ...cell, liteEffect: piece?.liteEffect ?? null }));
    };
    p.lock = function (...args) {
      const recording = this.phase === 'play' && this.active && this.dropsRemaining > 0;
      const firstId = this.id;
      // Record before lock: the original may rotate, clear or check rescue immediately.
      if (recording) this.lite.lastPlacementIds = this.cells().map((_, index) => firstId + index);
      if (this.phase === 'play' && this.active?.liteEffect === 'chameleon') {
        const own = new Set(this.cells().map(c => `${c.x},${c.y}`));
        const touching = this.board.filter(c => [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([dx, dy]) => own.has(`${c.x + dx},${c.y + dy}`)));
        const counts = new Map();
        for (const cell of touching) counts.set(cell.type, (counts.get(cell.type) || 0) + 1);
        const colors = [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
        if (colors.length) this.active.color = colors[0][0];
      }
      const result = original.lock.apply(this, args);
      if (recording) this.lite.lastPlacementIds = this.lite.lastPlacementIds.filter(id => id < this.id);
      return result;
    };
    p.awardCells = function (cells, source = 'outline') {
      const result = original.awardCells.call(this, cells, source);
      if (!cells.length) return result;
      const bonusCells = cells.filter(c => c.liteEffect === 'bonus').length;
      const extra = bonusCells * (RULES.bonusPerCell + (hasBuff(this, 'bonus-score') ? 5 : 0))
        + (cells.length>=4?cells.filter(c=>c.liteEffect==='link').length*6:0)
        + (source === 'outline' && hasBuff(this, 'clear-score') ? 20 : 0);
      const coins=cells.filter(c=>c.liteEffect==='coin').length;this.lite.coins+=coins;result.liteCoins=coins;
      if (source === 'outline') this.lite.clears++;
      this.score += extra;
      this.levelScore += extra;
      this.checkpointScore += extra;
      this.chainPoints += extra;
      result.points += extra;
      result.liteBonus = extra;
      result.chainPoints = this.chainPoints;
      const triggered = [];
      if (source === 'outline' && hasBuff(this, 'clear-score')) triggered.push('clear-score');
      if (bonusCells && hasBuff(this, 'bonus-score')) triggered.push('bonus-score');
      result.triggered = [...(result.triggered || []), ...triggered];
      result.cellFeedback ||= {};
      for (const id of triggered) result.cellFeedback['buff:' + id] = cells.filter(c => id === 'clear-score' || c.liteEffect === 'bonus');
      return result;
    };
    p.finishRotation = function (...args) {
      // Only a real, valid core turn can award an item. Previews clone the model.
      if (this.phase === 'rotating' && this.valid(this.board, []) && this.lastTorque.dir) {
        if (this.liteRandom() < RULES.rotorDropChance) {
          const tool = randomTool(this);
          this.lite.tools[tool] = (this.lite.tools[tool] || 0) + 1;
          this.events.push({ kind: 'lite-drop', tool });
        }
      }
      const result = original.finishRotation.apply(this, args);
      this.energy = 0;
      return result;
    };
    p.completeCheckpoint = function () {
      // The original score gate also performs completion cleanup and emits renderer events.
      return original.completeCheckpoint.call(this);
    };
    p.checkDeadlock = function (...args) {
      // The original rescue search knows neither lite tool. Let the player use
      // an available shovel or swap before declaring the position unrecoverable.
      if (this.lite?.tools.shovel > 0 && this.liteShovelCells().length || this.lite?.tools.swap > 0) {
        this.deadlockCells = [];
        this.deadlockWarning = null;
        return false;
      }
      return original.checkDeadlock.apply(this, args);
    };

    p.liteShovelCells = function () {
      const ids = new Set(this.lite?.lastPlacementIds || []);
      return this.board.filter(cell => ids.has(cell.id));
    };
    p.liteDyeColor = function () {
      const counts = new Map();
      for (const cell of this.board) counts.set(cell.type, (counts.get(cell.type) || 0) + 1);
      return [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] ?? null;
    };
    p.liteCanUseTool = function (type) {
      if (this.phase !== 'play' || !this.stageCommitted || !this.active || !(this.lite.tools[type] > 0)) return false;
      if (type === 'shovel') return this.liteShovelCells().length > 0;
      if (type === 'dye') { const color = this.liteDyeColor(); return !!color && color !== (this.active.color || this.active.type); }
      if (type === 'repair') return this.lives < 3;
      const effect=RULES.tools.find(tool=>tool.id===type)?.blockEffect;
      if(effect)return this.active.liteEffect!==effect;
      return type === 'swap' || type === 'supply';
    };
    p.liteUseTool = function (type) {
      if (!this.liteCanUseTool(type)) return false;
      if (type === 'shovel') {
        const cells = this.liteShovelCells();
        if (!cells.length) return false;
        const ids = new Set(cells.map(cell => cell.id));
        this.board = this.board.filter(cell => !ids.has(cell.id));
        this.lite.lastPlacementIds = [];
        this.events.push({ kind: 'lite-shovel', cells });
        this.deadlockCells = [];
        this.deadlockWarning = null;
      } else if (type === 'swap') {
        this.active = null;
        this.spawn();
        this.events.push({ kind: 'lite-swap' });
      } else if (type === 'supply') {
        this.lite.extraDrops = (this.lite.extraDrops || 0) + 3;
        this.events.push({ kind: 'lite-tool', tool: type });
      } else if (type === 'dye') {
        this.active.color = this.liteDyeColor();
        this.events.push({ kind: 'lite-tool', tool: type });
      } else if (type === 'repair') {
        this.lives++;
        this.events.push({ kind: 'lite-tool', tool: type });
      } else {
        const effect=RULES.tools.find(tool=>tool.id===type)?.blockEffect;if(!effect)return false;
        this.active.liteEffect=effect;
        if(effect==='pigment')this.active.color=this.liteDyeColor()||this.active.color||this.active.type;
        this.events.push({kind:'lite-tool',tool:type});
      }
      this.lite.tools[type]--;
      this.build.revision++;
      return true;
    };
    p.liteRewardOptions = function (route, previous = []) {
      const catalog=route==='buff'?BUFFS:route==='tool'?RULES.tools:RULES.specials,owned=route==='buff'?this.lite.buffs:[];
      const fresh=catalog.filter(item=>!owned.includes(item.id)).map(item=>item.id);
      const used=catalog.filter(item=>owned.includes(item.id)).map(item=>item.id);
      const shuffle=items=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(this.liteRandom()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;};
      const pool=[...shuffle(fresh),...shuffle(used)],options=pool.slice(0,3);
      // Make a refresh visibly change a choice whenever another candidate exists.
      if(previous.length&&options.every(id=>previous.includes(id))){
        const candidates=fresh.length>=3?fresh:pool,other=candidates.find(id=>!previous.includes(id));
        if(other)options[2]=other;
      }
      return options;
    };
    p.liteCanRefreshReward = function () {
      const r=this.lite.roll;return !!(rewardPhase(this)&&r?.entered&&!r.settled&&['buff','special'].includes(r.route));
    };
    p.liteRefreshReward = function () {
      const r=this.lite.roll;if(!this.liteCanRefreshReward()||r.adReadyAt||(r.freeRefreshes??1)<=0)return false;
      r.freeRefreshes=(r.freeRefreshes??1)-1;
      const key=r.route==='buff'?'buffOptions':'specialOptions';r[key]=this.liteRewardOptions(r.route,r[key]);
      this.events.push({kind:'lite-refresh',route:r.route});return true;
    };
    p.liteStartRewardAd = function (now=Date.now()) {
      const r=this.lite.roll;if(!this.liteCanRefreshReward()||r.adReadyAt||(r.freeRefreshes??1)>0||(r.adRefreshes??3)<=0)return false;
      r.adReadyAt=now+2000;return true;
    };
    p.liteFinishRewardAd = function (now=Date.now()) {
      const r=this.lite.roll;if(!this.liteCanRefreshReward()||!r.adReadyAt||now<r.adReadyAt||(r.adRefreshes??3)<=0)return false;
      r.adRefreshes=(r.adRefreshes??3)-1;r.adReadyAt=null;
      const key=r.route==='buff'?'buffOptions':'specialOptions';r[key]=this.liteRewardOptions(r.route,r[key]);
      this.events.push({kind:'lite-refresh',route:r.route});return true;
    };
    p.litePrepareDice = function () {
      if(!this.lite.diceSides)this.lite.diceSides=Array.from({length:3},()=>RULES.diceTypes[Math.floor(this.liteRandom()*RULES.diceTypes.length)]);
      return this.lite.diceSides;
    };
    p.litePrepareRoutes = function () {
      if(!this.lite.routeChoices){
        const shuffle=pool=>{for(let i=pool.length-1;i>0;i--){const j=Math.floor(this.liteRandom()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}return pool;};
        const newCount=this.liteRandom()<RULES.rewardMix.twoNewChance?2:1;
        const jackpot=this.liteRandom()<RULES.rewardMix.jackpotInclusionChance;
        const oldPool=shuffle(RULES.rewardRoutes.slice(0,4).map(route=>route.id));
        const newPool=shuffle(['exchange','gamble',...(this.endless||this.stage<RULES.levels-1?['rest']:[])]);
        this.lite.routeChoices=shuffle([...oldPool.slice(0,4-newCount),...(jackpot?['jackpot']:[]),...newPool.slice(0,newCount-(jackpot?1:0))]);
      }
      return this.lite.routeChoices;
    };
    p.liteRewardRanges = function (sides=this.litePrepareDice()) {
      const entry=root.LITE_DICE_ROUTES.combinations[[...sides].sort((a,b)=>a-b).join('-')];
      return this.litePrepareRoutes().map((id,i)=>({...RULES.rewardRoutes.find(route=>route.id===id),min:i===0?3:entry.cuts[i-1]+1,max:entry.cuts[i]??entry.max}));
    };
    p.liteRefreshDice = function () {
      if(!rewardPhase(this)||this.lite.roll?.entered||(this.lite.diceRefreshes??1)<=0)return false;
      const previous=this.litePrepareDice();this.lite.diceSides=null;
      const next=this.litePrepareDice();
      if(next.every((s,i)=>s===previous[i]))next[2]=RULES.diceTypes[(RULES.diceTypes.indexOf(next[2])+1)%RULES.diceTypes.length];
      this.lite.diceRefreshes=(this.lite.diceRefreshes??1)-1;this.lite.roll=null;
      this.events.push({kind:'lite-dice-refresh'});return true;
    };
    p.liteRoll = function () {
      if (!rewardPhase(this) || this.lite.roll) return false;
      const routes=[...this.litePrepareRoutes()];
      // Roll all three dice first; later draws cannot affect their faces.
      const sides=[...this.litePrepareDice()];
      const values = sides.map(sides => 1 + Math.floor(this.liteRandom() * sides));
      const total = values.reduce((sum, value) => sum + value, 0);
      const route = this.liteRewardRanges(sides).find(r => total >= r.min && total <= r.max).id;
      const buffOptions = route === 'buff' ? this.liteRewardOptions('buff') : [];
      let coins = RULES.clearCoins;
      const tools = emptyTools();
      const toolOptions=route==='tool'?this.liteRewardOptions('tool'):[];
      const specialOptions=route==='special'?this.liteRewardOptions('special'):[];
      const shopOffers = route === 'shop' ? this.liteCreateShop() : [];
      const exchangeOptions=route==='exchange'?this.liteRewardOptions('tool'):[];
      const gamble=route==='gamble'?{pot:5,attempts:0,maxAttempts:2,lastDie:null,lost:false,collected:0}:null;
      const jackpotOptions=route==='jackpot'?[{key:'coin',kind:'coin',item:null,amount:RULES.coinReward},...RULES.tools.map(tool=>({key:'tool:'+tool.id,kind:'tool',item:tool.id,amount:1})),...BUFFS.filter(buff=>!this.lite.buffs.includes(buff.id)).map(buff=>({key:'buff:'+buff.id,kind:'buff',item:buff.id,amount:1}))]:[];
      const nextStage=this.stage+1,preview={...this,stage:nextStage,outline:null};
      const restBuffs=route==='rest'?BUFFS.filter(buff=>!this.lite.buffs.includes(buff.id)):[];
      const rest=route==='rest'?{stage:nextStage,score:RULES.scoreGoals[nextStage]??originalTarget.call(preview).goals[0],coins:RULES.clearCoins,buff:restBuffs.length?restBuffs[Math.floor(this.liteRandom()*restBuffs.length)].id:null,convertedCoins:restBuffs.length?0:RULES.coinReward,claimed:false}:null;
      this.lite.roll = { sides, values, total, route, routes, entered: false, coins, tools, toolOptions, chosenTool:null, specialKind:null, specialOptions,buffOptions, shopOffers, exchangeOptions,chosenExchange:null,gamble,rest,jackpotOptions,jackpotChosen:null,chosenBuff: null, settled: route==='shop',freeRefreshes:1,adRefreshes:3,adReadyAt:null };
      this.events.push({ kind: 'lite-reward', reward: structuredClone(this.lite.roll) });
      return this.lite.roll;
    };
    p.liteEnterReward = function () {
      const roll = this.lite.roll;
      if (!rewardPhase(this) || !roll || roll.entered) return false;
      roll.entered = true;
      this.lite.coins += roll.coins;
      for (const { id } of RULES.tools) this.lite.tools[id] = (this.lite.tools[id] || 0) + (roll.tools[id] || 0);
      this.lite.specials ||= [];
      this.events.push({ kind: 'lite-reward-enter', route: roll.route });
      return true;
    };
    p.liteChooseTool = function (id) {
      const r=this.lite.roll;
      if(!rewardPhase(this)||!r?.entered||r.route!=='tool'||r.settled||!r.toolOptions?.includes(id))return false;
      this.lite.tools[id]=(this.lite.tools[id]||0)+1;
      r.tools[id]=1;r.chosenTool=id;r.settled=true;
      this.events.push({kind:'lite-tool-choice',id});return true;
    };
    p.liteChooseBuff = function (id) {
      const roll = this.lite.roll;
      if (!rewardPhase(this) || !roll?.entered || roll.route !== 'buff' || roll.settled || roll.adReadyAt || !roll.buffOptions.includes(id)) return false;
      if(this.lite.buffs.includes(id)){this.lite.coins+=RULES.coinReward;roll.convertedCoins=RULES.coinReward;}else this.lite.buffs.push(id);
      roll.chosenBuff = id;
      roll.settled = true;
      this.events.push({ kind: 'lite-buff', id });
      return true;
    };
    p.liteChooseSpecial = function (id) {
      const r=this.lite.roll;if(!rewardPhase(this)||!r?.entered||r.route!=='special'||r.settled||r.adReadyAt||!r.specialOptions?.includes(id))return false;
      this.lite.tools['block-'+id]=(this.lite.tools['block-'+id]||0)+1;
      r.specialKind=id;r.settled=true;this.events.push({kind:'lite-special',id});return true;
    };
    p.liteExchange = function (giveId,receiveId) {
      const r=this.lite.roll;
      if(!rewardPhase(this)||!r?.entered||r.route!=='exchange'||r.settled||giveId===receiveId||!RULES.tools.some(tool=>tool.id===giveId)||!(this.lite.tools[giveId]>0)||!r.exchangeOptions?.includes(receiveId))return false;
      this.lite.tools[giveId]--;this.lite.tools[receiveId]=(this.lite.tools[receiveId]||0)+1;
      r.chosenExchange={give:giveId,receive:receiveId};r.settled=true;
      this.events.push({kind:'lite-extra-tool',id:receiveId});return true;
    };
    p.liteSkipExchange = function () {
      const r=this.lite.roll;if(!rewardPhase(this)||!r?.entered||r.route!=='exchange'||r.settled)return false;
      r.exchangeSkipped=true;r.settled=true;return true;
    };
    p.liteGamble = function () {
      const r=this.lite.roll,g=r?.gamble;
      if(!rewardPhase(this)||!r?.entered||r.route!=='gamble'||r.settled||!g||g.lost||g.attempts>=g.maxAttempts)return false;
      g.lastDie=1+Math.floor(this.liteRandom()*6);g.attempts++;
      if(g.lastDie>=4)g.pot*=2;else{g.pot=0;g.lost=true;}
      this.events.push({kind:'lite-gamble',die:g.lastDie,pot:g.pot,lost:g.lost});return true;
    };
    p.liteCollectGamble = function () {
      const r=this.lite.roll,g=r?.gamble;
      if(!rewardPhase(this)||!r?.entered||r.route!=='gamble'||r.settled||!g)return false;
      g.collected=g.pot;this.lite.coins+=g.collected;r.settled=true;
      this.events.push({kind:'lite-gamble-collect',coins:g.collected});return true;
    };
    p.liteRest = function () {
      const r=this.lite.roll;
      if(!rewardPhase(this)||!r?.entered||r.route!=='rest'||r.settled||!r.rest||r.rest.claimed||(!this.endless&&this.stage>=RULES.levels-1))return false;
      this.score+=r.rest.score;
      if(r.rest.buff&&!this.lite.buffs.includes(r.rest.buff)){this.lite.buffs.push(r.rest.buff);this.events.push({kind:'lite-buff',id:r.rest.buff});}
      else if(r.rest.buff)r.rest.convertedCoins=RULES.coinReward;
      this.lite.coins+=r.rest.coins+r.rest.convertedCoins;r.rest.claimed=true;r.settled=true;
      this.events.push({kind:'lite-rest',stage:r.rest.stage,score:r.rest.score});return true;
    };
    p.liteClaimJackpot = function (keys) {
      const r=this.lite.roll;
      if(!rewardPhase(this)||!r?.entered||r.route!=='jackpot'||r.settled||!Array.isArray(keys)||keys.length!==3||new Set(keys).size!==3)return false;
      const choices=keys.map(key=>r.jackpotOptions?.find(option=>option.key===key));
      if(choices.some(option=>!option||option.kind==='buff'&&this.lite.buffs.includes(option.item)))return false;
      for(const option of choices){
        if(option.kind==='coin')this.lite.coins+=option.amount;
        else if(option.kind==='tool'){
          this.lite.tools[option.item]=(this.lite.tools[option.item]||0)+option.amount;
          this.events.push({kind:'lite-extra-tool',id:option.item});
        }else if(option.kind==='buff'){
          this.lite.buffs.push(option.item);this.events.push({kind:'lite-buff',id:option.item});
        }
      }
      r.jackpotChosen=[...keys];r.settled=true;return true;
    };
    p.liteNextStageInfo = function () {
      const stage=this.stage+(this.lite.roll?.route==='rest'&&this.lite.roll.rest?.claimed?2:1);
      if(!this.endless&&stage>=RULES.levels)return {stage:RULES.levels-1,won:true,goal:null};
      return {stage,won:false,goal:RULES.scoreGoals[stage]??originalTarget.call({...this,stage,outline:null}).goals[0]};
    };
    p.liteCreateShop = function () {
      const pools = [
        { kind: 'tool', ids: RULES.tools.filter(tool=>!tool.blockEffect).map(tool => tool.id) },
        { kind: 'buff', ids: BUFFS.filter(b => !this.lite.buffs.includes(b.id)).map(b => b.id) },
        { kind: 'special', ids: RULES.specials.map(b => b.id) }
      ];
      const offers = [];
      const draw = pool => {
        const index = Math.floor(this.liteRandom() * pool.ids.length), item = pool.ids[index];
        offers.push({ slot: offers.length, kind: pool.kind, item, price: RULES.toolPrice, sold: false });
        // Permanent unlocks appear once per visit; consumables may restock in other slots.
        if (pool.kind === 'buff') pool.ids.splice(index, 1);
      };
      for (const pool of pools) if (pool.ids.length) draw(pool);
      while (offers.length < RULES.shopSlots) {
        const available = pools.filter(pool => pool.ids.length);
        draw(available[Math.floor(this.liteRandom() * available.length)]);
      }
      for (let i = offers.length - 1; i > 0; i--) {
        const j = Math.floor(this.liteRandom() * (i + 1));
        [offers[i], offers[j]] = [offers[j], offers[i]];
      }
      return offers;
    };
    p.liteBuyOffer = function (slot) {
      const roll = this.lite.roll;
      if (!rewardPhase(this) || !roll?.entered || roll.route !== 'shop') return false;
      const offer = roll.shopOffers?.find(item => item.slot === slot);
      if (!offer || offer.sold || this.lite.coins < offer.price) return false;
      if (offer.kind === 'buff' && this.lite.buffs.includes(offer.item)) return false;
      this.lite.coins -= offer.price;
      offer.sold = true;
      if (offer.kind === 'tool') this.lite.tools[offer.item] = (this.lite.tools[offer.item] || 0) + 1;
      else if (offer.kind === 'buff') this.lite.buffs.push(offer.item);
      else this.lite.tools['block-'+offer.item]=(this.lite.tools['block-'+offer.item]||0)+1;
      this.events.push({ kind: 'lite-buy', item: offer.item, category: offer.kind });
      return true;
    };
    p.liteNext = function () {
      if (!rewardPhase(this) || !this.lite.roll?.entered || !this.lite.roll.settled) return false;
      const next=this.liteNextStageInfo();
      if (next.won) {
        this.stage=next.stage;
        this.phase = 'won';
        this.events.push({ kind: 'won', stage: this.stage, score: this.score });
        return true;
      }
      this.stage=next.stage;
      this.checkpoint = 0;
      this.outline = null;
      this.board = [];
      this.active = null;
      this.lite.clears = 0;
      this.lite.roll = null;
      this.lite.routeChoices=null;
      this.lite.diceSides=null;this.lite.diceRefreshes=1;
      this.lite.lastPlacementIds = [];
      this.lite.extraDrops = 0;
      if (hasBuff(this, 'shovel-supply')) this.lite.tools.shovel++;
      this.levelScore = 0;
      this.checkpointScore = 0;
      this.dropsUsed = 0;
      this.stageCommitted = true;
      this.stageDropBudget = null;
      this.chain = 0;
      this.chainPoints = 0;
      this.clearStreak = 0;
      this.levelMaxChain = 0;
      this.levelMaxMultiplier = 1;
      this.lastScore = null;
      this.pendingSpecial = null;
      this.settlement = null;
      this.build.placement = null;
      this.build.revision++;
      this.phase = 'play';
      this.spawn();
      this.events.push({ kind: 'stage-start', stage: this.stage, checkpoint: 0 });
      return true;
    };
    p.advanceStage = function () { return this.liteNext(); };
  };
})(globalThis);
