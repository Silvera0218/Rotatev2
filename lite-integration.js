// Executed inside the original game closure: preserve its renderer and controls.
const liteConfig = globalThis.ROTATION_LITE;
let liteRewardStage = -1, liteRolling = false;
let liteNaturalFall = true;
let liteDice = null, liteRewardPanel = null, liteLastBadge = null, liteLastHint = '';
const liteAcquisitionQueue=[];let liteAcquisitionPlaying=false;
let liteShopDialog=null,liteShopSelection=null;
let liteRouteCarousel=null;
const liteTool = id => liteConfig.tools.find(tool=>tool.id===id);
const liteToolName = id => liteTool(id)?.name||id;
const liteSpecial=id=>liteConfig.specials.find(block=>block.id===id);
const liteBlockIcon=id=>`<img class="lite-block-icon" src="./assets/icons/block-${id}.svg" width="32" height="32" alt="" aria-hidden="true">`;
const liteText=(node,text)=>{text=String(text);if(node.textContent!==text)node.textContent=text;};
const liteBuffs = () => Array.isArray(liteConfig.buffs) ? liteConfig.buffs : Object.values(liteConfig.buffs || {});
const liteBuff = id => liteBuffs().find(b => b.id === id) || {id,name:id,description:''};
const liteIcon = (kind) => {
  if(liteTool(kind)?.blockEffect)return liteBlockIcon(liteTool(kind).blockEffect);
  if(liteTool(kind))return `<img src="./assets/icons/${kind}.svg" width="32" height="32" alt="" aria-hidden="true">`;
  const paths={coin:'M6 2h8v2h2v2h2v8h-2v2h-2v2H6v-2H4v-2H2V6h2V4h2z M9 5v10h2V5z',shovel:'M12 1h5v5h-2v3h-2v3h-2v5H8v2H3v-5h2v-3h5V9h2V6h-2V1z',swap:'M4 3h10V1l5 5-5 5V8H4z M16 17H6v2l-5-5 5-5v3h10z',buff:'M8 1h4v5h5v3h-4v4h-3v5H7v-6H2V9h4V5h2z'};
  return `<svg viewBox="0 0 20 20" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="${paths[kind]||paths.buff}"/></svg>`;
};
const toolbar = document.createElement('div');toolbar.id='lite-toolbar';
toolbar.innerHTML=`<div class="lite-wallet">${liteIcon('coin')}<b id="lite-coins">0</b><span>金币</span></div><div class="lite-run-score"><small>本局得分</small><b id="lite-score">0</b></div><button id="lite-shovel" type="button">${liteIcon('shovel')}<span>铲子</span><b>1</b></button><button id="lite-swap" type="button">${liteIcon('swap')}<span>换块</span><b>1</b></button>`;
I('game-ui').append(toolbar);
const toolRail=document.createElement('div');toolRail.id='lite-tool-rail';toolRail.setAttribute('role','group');toolRail.setAttribute('aria-label','主动道具');
for(const {id:kind} of liteConfig.tools){let button=I('lite-'+kind);if(!button){button=document.createElement('button');button.id='lite-'+kind;button.type='button';}button.className='insertion-button';button.innerHTML=`<span class="insertion-glyph">${liteIcon(kind)}</span><b class="insertion-price">0</b><span class="insertion-name">${liteToolName(kind)}</span>`;toolRail.append(button);}
I('game-ui').append(toolRail);
const levelLabel=document.createElement('div');levelLabel.id='lite-level-label';toolbar.insertBefore(levelLabel,toolbar.querySelector('.lite-run-score'));
for (const id of ['lite-special-hint']) {const node=document.createElement('div');node.id=id;I('game-ui').append(node);}
const toast=document.createElement('div');toast.id='lite-toast';toast.setAttribute('role','status');I('stage').append(toast);let toastTimer;
function liteToast(text,acquired=false){toast.textContent=text;toast.classList.toggle('lite-acquired-toast',acquired);toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2400);}
function liteCanAct(){return he&&!G0&&!Pt&&!k0&&!Ie.busy&&!pe.particles.length&&!me.active&&L.phase==='play'&&I('overlay').hidden;}
for(const tool of liteConfig.tools)I('lite-'+tool.id).onclick=()=>{
  if(!liteCanAct()||!L.liteUseTool(tool.id))return;
  _t();if(tool.id==='swap')resetDropVisuals();yt=0;fe.dirty=true;d3();se.play(tool.id==='swap'?'lock':'clear');
  const messages={shovel:'已铲除上一次投放的方块',swap:'已换成下一块',supply:'本关投放机会 +3',dye:'当前落块已染成棋盘主色',repair:'落空容错 +1'};liteToast(tool.blockEffect?'当前落块已改造为'+tool.name:messages[tool.id]);liteSaveSafe();
};
// Reuse the original buff rail, badge decorator and detail dialog.
zf.sync=function(){
  const key=L.lite.buffs.join(',');if(key===liteLastBadge)return;liteLastBadge=key;
  const list=I('buff-hud').querySelector('.buff-list');list.replaceChildren();
  if(!L.lite.buffs.length){const empty=document.createElement('span');empty.className='buff-empty';empty.textContent='通关投骰获得';list.append(empty);return;}
  for(const id of L.lite.buffs){
    const buff=liteBuff(id),button=document.createElement('button');button.type='button';button.className='buff-chip';button.dataset.buff=id;button.dataset.buffTone=v6(1);button.append(buff.name+' ',y6('×1'));button.title=buff.description;button.setAttribute('aria-label',buff.name+'，点击查看当前效果');
    button.onclick=()=>{if(!liteCanAct())return;_t();G0=true;se.pause();I('pause').textContent='继续';Ht(buff.name,'','继续游戏','BUFF');I('overlay').dataset.buffDetail='true';
      const copy=I('dialog-copy');copy.dataset.buffTone=v6(1);const layers=document.createElement('div');layers.className='buff-layers';layers.append('层数：',y6(1));const effect=document.createElement('div');effect.className='buff-effect';effect.textContent=buff.description;const note=document.createElement('div');note.className='buff-note';note.textContent='本局有效';copy.replaceChildren(layers,effect,note);I('game-ui').inert=true;
    };list.append(button);
  }
};
const liteOriginalTokens=on.tokens.bind(on),liteOriginalPulse=on.pulse.bind(on);
on.tokens=scoring=>[...liteOriginalTokens(scoring),...(scoring.triggered||[]).filter(id=>liteBuffs().some(b=>b.id===id)).map(id=>({kind:'buff',id}))];
on.pulse=(token,progress,reduced)=>{
  if(!liteBuffs().some(b=>b.id===token.id))return liteOriginalPulse(token,progress,reduced);
  const badge=I('buff-hud').querySelector(`[data-buff="${token.id}"]`);if(!badge)return;
  if(progress>=1){delete badge.dataset.procActive;badge.style.removeProperty('transform');return;}
  badge.dataset.procActive='true';badge.style.transform=reduced?'':`scale(${1+.045*Math.sin(progress*Math.PI)})`;
  const notice=I('buff-proc');notice.hidden=false;notice.textContent='触发 · '+liteBuff(token.id).name;
};
// Eliminate original card, insertion and rotor-choice entry points in this copy.
ka = startWithoutRotor;
const liteOriginalStart=ka;
ka=function(...args){liteRewardStage=-1;liteRolling=false;liteAcquisitionQueue.length=0;I('stage').querySelectorAll('.lite-clear-burst').forEach(n=>n.remove());liteDice?.skip();liteCloseReward();const result=liteOriginalStart(...args);L.beginStage();S1(`填满轮廓得分 · 本关目标 ${L.goal} 分`);liteSync();return result;};
Ca=function(){L.beginStage();G0=false;I('overlay').hidden=true;};
const liteOriginalWa=wa;
wa=function(){liteOriginalWa();if(L.lite){I('phase-label').textContent='本关得分';I('goal-track').setAttribute('aria-label','本关分数进度');}};
const liteOriginalV3=V3;
V3=function(){liteOriginalV3();liteSync();};
function liteSync(){
  if(!L.lite)return;
  liteText(I('round'),L.endless?`无尽 · 第 ${L.stage+1} 关`:`第 ${L.stage+1} / ${liteConfig.levels} 关`);
  liteText(levelLabel,L.endless?`无尽 · 第 ${L.stage+1} 关`:`第 ${L.stage+1} / ${liteConfig.levels} 关`);
  liteText(I('lite-coins'),L.lite.coins);liteText(I('lite-score'),Ne(L.score));
  for(const tool of liteConfig.tools){
    const button=I('lite-'+tool.id),count=L.lite.tools[tool.id]||0;liteText(button.querySelector('b'),count);
    button.hidden=count===0;
    const disabled=!liteCanAct()||!L.liteCanUseTool(tool.id);if(button.disabled!==disabled)button.disabled=disabled;
    let hint=tool.description;if(tool.id==='repair'&&L.lives>=3)hint='容错已满';if(tool.id==='dye'&&!L.liteDyeColor())hint='棋盘上还没有可取色的方块';
    const label=`${tool.name}，剩余 ${count} 次，${hint}`;if(button.getAttribute('aria-label')!==label){button.setAttribute('aria-label',label);button.title=label;}
  }
  zf.sync();
  const special=L.active?.liteEffect;const upcoming=L.lite.nextEffect||L.nextLiteEffect||null;
  const title=liteSpecial(special)?.name||`目标 ${L.goal} 分 · 达标后投骰`;
  if(title!==liteLastHint){liteLastHint=title;I('lite-special-hint').textContent=title;}
  if(upcoming)liteText(I('next-caption'),'下一个 · '+liteSpecial(upcoming).name);
  liteText(I('growth-summary'),L.lite.buffs.length?L.lite.buffs.map(id=>liteBuff(id).name).join(' · '):'本局暂无 buff');
}
const liteOriginalD3=d3;
d3=function(...args){
  const events=L.events.filter(e=>['lite-drop','lite-buy','lite-special','lite-tool-choice','lite-extra-tool','lite-reward-enter','stage-start'].includes(e.kind));const result=liteOriginalD3(...args);
  for(const e of events){
    const incoming=[];let stage=L.stage+1;
    if(e.kind==='lite-drop'){incoming.push(e.tool);stage=L.stage;}
    else if(e.kind==='lite-buy'&&e.category!=='buff')incoming.push(e.category==='special'?'block-'+e.item:e.item);
    else if(e.kind==='lite-special')incoming.push('block-'+e.id);
    else if(e.kind==='lite-tool-choice')incoming.push(e.id);
    else if(e.kind==='lite-extra-tool')incoming.push(e.id);
    else if(e.kind==='lite-reward-enter'&&e.route==='tool')incoming.push(...Object.keys(L.lite.roll.tools).filter(id=>L.lite.roll.tools[id]));
    else if(e.kind==='stage-start'&&L.lite.buffs.includes('shovel-supply')){incoming.push('shovel');stage=L.stage;}
    for(const id of incoming)liteAcquisitionQueue.push({id,stage});
  }
  return result;
};
function litePlayPendingAcquisition(){
  if(liteAcquisitionPlaying||!liteCanAct())return;
  while(liteAcquisitionQueue.length&&(liteAcquisitionQueue[0].stage<L.stage||liteAcquisitionQueue[0].stage===L.stage&&!L.lite.tools[liteAcquisitionQueue[0].id]))liteAcquisitionQueue.shift();
  const entry=liteAcquisitionQueue[0];if(!entry||entry.stage!==L.stage)return;liteAcquisitionQueue.shift();liteSync();
  const button=I('lite-'+entry.id);if(!button||button.hidden)return;
  const rail=toolRail.getBoundingClientRect(),r=button.getBoundingClientRect();if(r.top<rail.top||r.bottom>rail.bottom)toolRail.scrollTop+=r.top-rail.top-12;
  const project=(x,y,z=0)=>{const rect=I('stage').getBoundingClientRect(),p=new U(x,y,z).project(Bt);return{x:rect.left+I('stage').clientLeft+(p.x+1)*Ge.w/2,y:rect.top+I('stage').clientTop+Ge.top+(1-p.y)*Ge.playHeight/2};};
  const sources=L.board.slice(-12).map(c=>{const p=rotorCellPositions.get(c.id)||c;return project(p.x,p.y,p.z||0);});
  liteAcquisitionPlaying=true;se.play('clear');liteToast(`获得 ${liteToolName(entry.id)} +1`,true);
  playLiteAcquisition({button,origin:project(0,0),sources}).finally(()=>{liteAcquisitionPlaying=false;});
}
// Screen-space fragments follow the cleared cells, below the score lettering.
function liteClearBurst(cells,anchor,color,combo){
  if(zt)return;
  const stage=I('stage');
  const project=c=>{const p=new U(c.x,c.y,0).project(Bt);return{x:(p.x+1)*Ge.w/2,y:Ge.top+(1-p.y)*Ge.playHeight/2};};
  const points=(cells.length?cells:[anchor]).map(project);
  const center=points.reduce((p,c)=>({x:p.x+c.x/points.length,y:p.y+c.y/points.length}),{x:0,y:0});
  const layer=document.createElement('div');layer.className='lite-clear-burst';layer.setAttribute('aria-hidden','true');
  layer.style.setProperty('--burst-color',color);
  const add=(className,x,y)=>{const n=document.createElement('i');n.className=className;n.style.left=x+'px';n.style.top=y+'px';layer.append(n);return n;};
  // One short flash and two stepped shock fronts, rather than a screen-wide flash.
  add('lite-clear-flash',center.x,center.y);
  for(let j=0;j<2;j++){const ring=add('lite-clear-ring',center.x,center.y);ring.style.setProperty('--delay',j?'.07s':'0s');ring.style.setProperty('--ring-size',(j?144:208)+'px');}
  const count=Math.min(64,28+cells.length*2+Math.min(combo,3)*4);
  for(let j=0;j<count;j++){
    const source=points[j%points.length],angle=j*2.39996+Math.random()*.32;
    const distance=58+Math.random()*78+Math.min(combo-1,3)*13;
    const n=add('lite-clear-fragment',source.x,source.y);
    const cell=cells[j%Math.max(1,cells.length)];
    n.style.background=j%4===0?'#fff':cell&&!cell.liteEffect?'#'+(i9[cell.color||cell.type]||i9.O).toString(16).padStart(6,'0'):color;
    n.style.setProperty('--dx',Math.cos(angle)*distance+'px');n.style.setProperty('--dy',Math.sin(angle)*distance+'px');
    n.style.setProperty('--fall',(28+Math.random()*34)+'px');n.style.setProperty('--size',(j%5===0?10:4+Math.floor(Math.random()*4))+'px');
    n.style.setProperty('--spin',(j%2?90:-90)+'deg');n.style.setProperty('--life',(.65+Math.random()*.25)+'s');
  }
  for(let j=0;j<10;j++){
    const ray=add('lite-clear-ray',center.x,center.y);ray.style.setProperty('--angle',j*36+'deg');ray.style.setProperty('--reach',(74+j%3*19)+'px');
  }
  stage.append(layer);layer.addEventListener('animationend',e=>{if(e.target===layer)layer.remove();});
}
// The final placed cell anchors each score burst; chained clears use their newest cell.
Of=function(scoring,cells=[]){
  const lastIds=new Set(L.lite.lastPlacementIds||[]),placed=cells.filter(c=>lastIds.has(c.id));
  const anchor=(placed.length?placed:cells).reduce((last,c)=>!last||c.id>last.id?c:last,null)||{x:0,y:0,type:'O'};
  const materialColors={bonus:'#ffdb56',chameleon:'#80bbff',coin:'#dfa44e',link:'#b6c9de',pigment:null};
  const color=materialColors[anchor.liteEffect]||'#'+(i9[anchor.color||anchor.type]||i9.O).toString(16).padStart(6,'0');
  const combo=Math.max(scoring.chain||1,scoring.streak||1),words=['','','二','三','四','五','六','七','八','九','十'];
  liteClearBurst(cells,anchor,color,combo);
  const title=combo>1?`${words[combo]||combo}连消除`:scoring.source==='tool'?'方块消除':'轮廓消除';
  const box=I('score-feedback'),number=I('feedback-points');
  c3={t:0,duration:zt?1.25:1.65,anchor:{x:anchor.x,y:anchor.y},combo};scorePopupPulse=null;
  box.hidden=false;box.dataset.tier=combo>=3?'burst':combo>1?'chain':'normal';box.style.setProperty('--score-color',color);
  I('feedback-title').textContent=title;I('feedback-multiplier').textContent='';I('feedback-detail').textContent='';
  number.textContent=`+${Ne(scoring.points)}`;number.style.removeProperty('transform');delete number.dataset.scorePulse;
  number.style.fontSize=(combo>=3?66:combo>1?60:52)+'px';
  box.querySelectorAll('.lite-score-spark').forEach(n=>n.remove());
  // Fit the full number during its largest overshoot, leaving room for the equipment rail.
  const available=Math.min(270,I('stage').clientWidth-112);
  if(number.offsetWidth*1.28>available)number.style.fontSize=Math.max(22,parseFloat(number.style.fontSize)*available/(number.offsetWidth*1.28))+'px';
  if(!zt)for(let j=0;j<8;j++){
    const spark=document.createElement('i'),angle=j*Math.PI/4;
    spark.className='lite-score-spark';spark.style.setProperty('--spark-x',Math.cos(angle)*76+'px');spark.style.setProperty('--spark-y',Math.sin(angle)*46+'px');spark.style.setProperty('--spark-delay',j%2?'.04s':'0s');spark.setAttribute('aria-hidden','true');box.append(spark);
  }
  const face=box.querySelector('.feedback-top');face.style.animation='none';void face.offsetWidth;face.style.removeProperty('animation');
  Ta(0);
};
Ta=function(dt){
  updateScorePulse(dt);if(!c3)return;c3.t+=dt;
  const box=I('score-feedback');if(c3.t>=c3.duration){box.hidden=true;c3=null;return;}
  const p=new U(c3.anchor.x,c3.anchor.y,0).project(Bt),stage=I('stage');
  const x=(p.x+1)*Ge.w/2,y=Ge.top+(1-p.y)*Ge.playHeight/2;
  const half=box.offsetWidth*.64+8,height=box.offsetHeight;
  const railLeft=toolRail.getBoundingClientRect().left-stage.getBoundingClientRect().left-stage.clientLeft;
  const right=Math.min(stage.clientWidth-8,railLeft-8);
  box.style.left=Math.max(half,Math.min(right-half,x))+'px';
  box.style.setProperty('top',Math.max(height+24,Math.min(stage.clientHeight-110,y-12))+'px','important');
  box.style.opacity=String(Math.min(1,(c3.duration-c3.t)/.32));
  box.style.transform=`translate(-50%,calc(-100% - ${zt?0:Math.max(0,c3.t-.22)*24}px))`;
};
function liteCloseReward(){liteCloseShopDetail(false);if(liteRewardPanel)liteRewardPanel.hidden=true;delete I('overlay').dataset.liteReward;delete I('overlay').dataset.litePage;}
function liteCloseShopDetail(restoreFocus=true){
  const selection=liteShopSelection;liteShopSelection=null;
  if(liteShopDialog?.open)liteShopDialog.close();
  if(restoreFocus&&selection){
    const card=I('lite-shop-offers')?.querySelector(`[data-slot="${selection.slot}"]`);
    (card&&!card.disabled&&!card.hidden?card:I('lite-next'))?.focus({preventScroll:true});
  }
}
function litePositionShopDetail(){
  if(!liteShopDialog?.open||!liteShopSelection)return;
  const {point}=liteShopSelection,view=window.visualViewport;
  const left=view?.offsetLeft||0,top=view?.offsetTop||0,width=view?.width||innerWidth,height=view?.height||innerHeight;
  const rect=liteShopDialog.getBoundingClientRect();
  const x=Math.max(left+12,Math.min(left+width-rect.width-12,point.x-rect.width/2));
  const below=point.y+14,above=point.y-rect.height-14;
  const y=Math.max(top+12,Math.min(top+height-rect.height-12,below+rect.height<=top+height-12?below:above));
  liteShopDialog.style.left=x+'px';liteShopDialog.style.top=y+'px';
}
function liteOpenShopDetail(offer,button,event){
  if(!liteShopDialog){
    liteShopDialog=document.createElement('dialog');liteShopDialog.id='lite-shop-detail';
    liteShopDialog.setAttribute('aria-labelledby','lite-shop-detail-name');liteShopDialog.setAttribute('aria-describedby','lite-shop-detail-effect');
    liteShopDialog.innerHTML='<div class="lite-shop-detail-head"><div id="lite-shop-detail-icon" aria-hidden="true"></div><div><small id="lite-shop-detail-category"></small><h2 id="lite-shop-detail-name"></h2></div></div><p id="lite-shop-detail-effect"></p><div class="lite-shop-detail-cost"><strong id="lite-shop-detail-price"></strong><span id="lite-shop-detail-wallet"></span></div><div class="lite-shop-detail-actions"><button type="button" id="lite-shop-detail-cancel">取消</button><button type="button" id="lite-shop-detail-buy">购买</button></div>';
    document.body.append(liteShopDialog);
    I('lite-shop-detail-cancel').onclick=()=>liteCloseShopDetail();
    liteShopDialog.addEventListener('cancel',e=>{e.preventDefault();liteCloseShopDetail();});
    liteShopDialog.addEventListener('keydown',e=>e.stopPropagation());
    let outsideDown=false;
    const outside=e=>{const r=liteShopDialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    liteShopDialog.addEventListener('pointerdown',e=>{outsideDown=outside(e);});
    liteShopDialog.addEventListener('click',e=>{if(outsideDown&&outside(e))liteCloseShopDetail();outsideDown=false;});
    I('lite-shop-detail-buy').onclick=()=>{
      const slot=liteShopSelection?.slot;if(slot===undefined)return;
      if(!L.liteBuyOffer(slot)){I('lite-shop-detail-buy').disabled=true;I('lite-shop-detail-buy').textContent='暂时无法购买';return;}
      liteUpdateReward();liteSync();d3();se.play('clear');liteSaveSafe();liteCloseShopDetail();
    };
    const reposition=()=>{if(!liteShopSelection)return;const r=liteShopSelection.button.getBoundingClientRect();liteShopSelection.point={x:r.left+r.width/2,y:r.top+r.height/2};litePositionShopDetail();};
    window.addEventListener('resize',reposition);window.visualViewport?.addEventListener('resize',reposition);
  }
  const rect=button.getBoundingClientRect();liteShopSelection={slot:offer.slot,button,point:event.detail?{x:event.clientX,y:event.clientY}:{x:rect.left+rect.width/2,y:rect.top+rect.height/2}};
  const entry=offer.kind==='buff'?liteBuff(offer.item):offer.kind==='special'?liteSpecial(offer.item):liteTool(offer.item);
  I('lite-shop-detail-name').textContent=entry.name+(offer.kind==='buff'?'':' +1');
  I('lite-shop-detail-category').textContent={tool:'道具',buff:'Buff',special:'方块改造'}[offer.kind];
  I('lite-shop-detail-effect').textContent=(offer.kind==='special'?'将当前下落块改造为'+entry.name+'。':'')+entry.description;
  const art=I('lite-shop-detail-icon');art.replaceChildren();
  if(offer.kind==='buff'){const badge=button.querySelector('.arc-buff-medallion');if(badge)art.append(badge.cloneNode(true));else art.innerHTML=liteIcon('buff');}
  else art.innerHTML=offer.kind==='special'?liteBlockIcon(offer.item):liteIcon(offer.item);
  I('lite-shop-detail-price').textContent=offer.price+' 金币';I('lite-shop-detail-wallet').textContent='持有 '+L.lite.coins+' 金币';
  const buy=I('lite-shop-detail-buy'),poor=L.lite.coins<offer.price;buy.disabled=poor||offer.sold;buy.textContent=offer.sold?'已售罄':poor?'金币不足':'购买';
  liteShopDialog.showModal();litePositionShopDetail();(buy.disabled?I('lite-shop-detail-cancel'):buy).focus({preventScroll:true});
}
function liteCreateReward(){
  if(liteRewardPanel)return;
  liteRewardPanel=document.createElement('section');liteRewardPanel.id='lite-reward-panel';liteRewardPanel.hidden=true;
  liteRewardPanel.innerHTML='<h2 class="lite-reward-title" id="lite-reward-title">投出下一站</h2><div id="lite-dice-stage"></div><p id="lite-dice-total" role="status"></p><p id="lite-reward-summary" role="status"></p><div id="lite-route-ranges"></div><div id="lite-reward-item" hidden></div><div id="lite-buff-choices"></div><button id="lite-roll" class="popup-primary" type="button">投掷</button><button id="lite-enter" class="popup-primary" type="button" hidden>进入奖励</button><div id="lite-shop" hidden><p>关间商店 <span id="lite-shop-wallet"></span></p><div id="lite-shop-offers"></div></div><button id="lite-next" class="popup-primary" type="button" hidden>下一关 →</button>';
  I('overlay').querySelector('.dialog').append(liteRewardPanel);liteDice=createLiteDice(I('lite-dice-stage'));
  const extra=document.createElement('section');extra.id='lite-extra-reward';extra.hidden=true;I('lite-next').before(extra);
  const comboLoot=document.createElement('details');comboLoot.id='lite-combo-loot';comboLoot.hidden=true;I('lite-reward-summary').after(comboLoot);
  const diceRefresh=document.createElement('button');diceRefresh.id='lite-refresh-dice';diceRefresh.type='button';diceRefresh.textContent='换一组骰子 · 免费 1 次';I('lite-dice-stage').after(diceRefresh);
  diceRefresh.onclick=()=>{if(liteRolling||!L.liteRefreshDice())return;liteDice.show(liteFaces(null));se.play('turn');liteUpdateReward();d3();liteSaveSafe();I('lite-roll').focus({preventScroll:true});};
  const shopHero=document.createElement('header');shopHero.id='lite-shop-hero';shopHero.innerHTML='<div class="lite-shop-hero-inner"><img src="./assets/ui/shopkeeper.png" width="128" height="128" alt="挥手的白色圆形机器人店员"><div><span>SHOP</span><h2 id="lite-shop-title">补给商城</h2></div></div>';liteRewardPanel.before(shopHero);
  const heading=document.createElement('div');heading.id='lite-reward-heading';I('lite-reward-title').before(heading);heading.append(I('lite-reward-title'),I('lite-shop-wallet'));I('lite-shop').querySelector('p').remove();
  const categories=document.createElement('nav');categories.id='lite-shop-categories';categories.setAttribute('aria-label','商品分类');
  for(const [id,label] of [['all','全部'],['special','方块'],['tool','道具'],['buff','Buff']]){
    const button=document.createElement('button');button.type='button';button.dataset.category=id;button.textContent=label;button.setAttribute('aria-pressed','false');
    button.onclick=()=>{
      if(L.lite.roll?.route!=='shop'||(L.lite.roll.shopCategory||'all')===id)return;
      L.lite.roll.shopCategory=id;liteUpdateReward();I('lite-shop-offers').scrollTop=0;liteSaveSafe();
    };categories.append(button);
  }
  I('lite-shop-offers').before(categories);
  const empty=document.createElement('p');empty.id='lite-shop-empty';empty.textContent='本次补货暂无这类商品';empty.hidden=true;I('lite-shop-offers').after(empty);
  const refresh=document.createElement('div');refresh.id='lite-choice-refresh';refresh.hidden=true;refresh.innerHTML='<button id="lite-refresh-reward" type="button"></button><span id="lite-refresh-status" role="status"></span>';I('lite-buff-choices').after(refresh);
  I('lite-refresh-reward').onclick=()=>{
    if((L.lite.roll?.freeRefreshes??1)>0){if(!L.liteRefreshReward())return;se.play('turn');d3();}
    else if(!L.liteStartRewardAd())return;
    liteUpdateReward();liteSaveSafe();
  };
  I('lite-roll').onclick=async()=>{
    if(liteRolling){liteDice.skip();return;}
    const result=L.liteRoll();if(!result)return;
    liteRolling=true;I('lite-refresh-dice').disabled=true;I('lite-roll').textContent='轻触跳过动画';I('lite-buff-choices').replaceChildren();I('lite-next').disabled=true;I('lite-shop').hidden=true;
    d3();liteSaveSafe();se.unlock();se.play('turn');await liteDice.roll(liteFaces(result));liteRolling=false;se.play('clear');liteUpdateReward();liteShowDiceCombo(result,true);d3();liteSaveSafe();I('lite-enter').focus({preventScroll:true});
  };
  I('lite-enter').onclick=event=>{
    if(liteRolling||L.lite.roll?.entered)return;
    liteLeaveReward(event.currentTarget,()=>{if(!L.liteEnterReward())return;se.play('turn');liteUpdateReward();d3();liteSaveSafe();I('lite-reward-title').setAttribute('tabindex','-1');I('lite-reward-title').focus({preventScroll:true});});
  };
  I('lite-next').onclick=event=>{
    if(liteRolling||!L.lite.roll?.entered||!L.lite.roll.settled||L.liteComboNeedsChoice())return;
    const next=L.liteNextStageInfo();
    se.unlock();z6({element:event.currentTarget,event,palette:l5[next.stage%l5.length],kicker:next.won?'本局完成':`目标 ${next.goal} 分`,title:next.won?'挑战完成':`第 ${next.stage+1} 关`,swap:()=>{if(!L.liteNext())return;liteCloseReward();G0=false;y5();I('overlay').hidden=true;Gt.reset();Ie.reset();pe.reset();G3();yt=0;k0=null;H3=-1;be.round=-1;v5(0,true);d3();Qt();liteSaveSafe();}});
  };
}
function liteLeaveReward(origin,complete,options={}){
  const target=I('overlay').querySelector('.dialog');
  if(target.getAttribute('aria-busy')==='true')return;
  target.setAttribute('aria-busy','true');target.inert=true;
  playLiteRewardWipe(()=>complete(),options).finally(()=>{target.removeAttribute('aria-busy');target.inert=false;(options.region?origin:I('lite-reward-title')).focus({preventScroll:true});});
}
function liteFaces(roll){return (roll?.sides||L.litePrepareDice()).map((sides,i)=>({kind:'number',sides,value:roll?.values[i]??null}));}
function liteSyncRouteCarousel(roll){
  const host=I('lite-route-ranges'),ranges=L.liteRewardRanges(roll?.sides||L.litePrepareDice());
  const key=ranges.map(r=>r.id+':'+r.min+':'+r.max).join('|');
  if(!liteRouteCarousel||liteRouteCarousel.key!==key){
    const track=document.createElement('div');track.className='lite-route-track';track.setAttribute('aria-hidden','true');
    for(let copy=0;copy<3;copy++)for(const r of ranges){
      const node=document.createElement('span');node.dataset.route=r.id;node.dataset.copy=copy;
      const icon=document.createElement('img');icon.src='./assets/icons/route-'+r.id+'.svg';icon.alt='';icon.width=36;icon.height=36;const title=document.createElement('b'),range=document.createElement('small');title.textContent=r.name;range.textContent=(r.min===r.max?r.min:r.min+'–'+r.max)+' 点';node.append(icon,title,range);track.append(node);
    }
    host.replaceChildren(track);host.setAttribute('role','status');
    liteRouteCarousel={key,track,ranges,position:0,last:performance.now(),mode:'new'};
  }
  const c=liteRouteCarousel,target=roll&&!liteRolling?c.ranges.findIndex(r=>r.id===roll.route):-1;
  if(target<0){c.mode='looping';host.dataset.motion='looping';host.setAttribute('aria-label',ranges.map(r=>`${r.min}至${r.max}点，${r.name}`).join('；'));}
  else if(c.mode==='looping'){
    c.mode='stopping';c.start=c.position;c.target=c.position+((target-c.position%4+4)%4)+4;c.since=performance.now();host.dataset.motion='stopping';
  }else if(c.mode==='new'){c.position=target;c.mode='settled';host.dataset.motion='settled';}
  if(target>=0)host.setAttribute('aria-label',`本次奖励：${ranges[target].name}，${ranges[target].min}至${ranges[target].max}点`);
  c.route=target>=0?roll.route:null;liteAnimateRouteCarousel(performance.now());
}
function liteAnimateRouteCarousel(now){
  const c=liteRouteCarousel,host=I('lite-route-ranges');if(!c||!host)return;
  const dt=Math.min(.05,(now-c.last)/1000);c.last=now;
  if(host.hidden||liteRewardPanel?.hidden||I('overlay').hidden)return;
  if(zt){if(c.mode==='stopping'){c.position=c.target;c.mode='settled';}}
  else if(c.mode==='looping')c.position=(c.position+dt*(liteRolling?3.8:.72))%4;
  if(c.mode==='stopping'){
    const t=Math.min(1,(now-c.since)/620);c.position=c.start+(c.target-c.start)*(1-(1-t)**3);
    if(t===1)c.mode='settled';
  }
  host.dataset.motion=c.mode;
  const tile=118,step=tile+12;
  host.style.setProperty('--route-width',tile+'px');
  c.track.style.transform=`translateX(${host.clientWidth/2-tile/2-(4+c.position%4)*step}px)`;
  for(const n of c.track.children)n.dataset.active=String(c.mode==='settled'&&n.dataset.route===c.route);
}
function liteShowDiceCombo(roll,animate=false){
  const stage=I('lite-dice-stage');stage.querySelector('.lite-dice-combo')?.remove();I('lite-dice-total').querySelector('.lite-dice-combo-reward')?.remove();
  if(!roll?.combo||roll.entered||liteRolling)return;
  const combo=roll.combo,fx=document.createElement('div');fx.className='lite-dice-combo';fx.dataset.combo=combo.id;fx.dataset.tier=combo.tier||'rare';
  fx.setAttribute('role','status');const title=document.createElement('strong'),reward=document.createElement('span');
  title.textContent=combo.name+'！';reward.className='lite-dice-combo-reward';reward.textContent=combo.description+' · 进入奖励页领取';fx.append(title);stage.append(fx);I('lite-dice-total').append(reward);
  if(!animate||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  fx.classList.add('is-burst');reward.classList.add('is-burst');
  const count=combo.tier==='legendary'?48:combo.tier==='epic'?36:24;
  for(let i=0;i<count;i++){const pixel=document.createElement('i'),angle=i*Math.PI*2/count;pixel.style.setProperty('--x',Math.cos(angle)*(100+i%3*28)+'px');pixel.style.setProperty('--y',Math.sin(angle)*(65+i%3*18)+'px');pixel.style.setProperty('--delay',i%4*25+'ms');fx.append(pixel);}
  se.play('turn');
}
function liteUpdateReward(){
  const roll=L.lite.roll,entered=!!roll?.entered,route=liteConfig.rewardRoutes.find(r=>r.id===roll?.route);
  const comboPending=L.liteComboNeedsChoice();
  const page=comboPending?'combo':entered?roll.route:'dice';liteRewardPanel.dataset.page=page;if(I('overlay').dataset.litePage!==page)I('overlay').dataset.litePage=page;
  I('lite-shop-wallet').hidden=page!=='shop';
  I('overlay').querySelector('.dialog').setAttribute('aria-labelledby',page==='shop'?'lite-shop-title':'lite-reward-title');
  I('lite-roll').hidden=!!roll;I('lite-enter').hidden=!roll||entered;I('lite-next').hidden=!entered||comboPending;
  I('lite-dice-stage').hidden=entered;I('lite-route-ranges').hidden=entered;I('lite-shop').hidden=page!=='shop'||roll?.legacyClaimed;
  const next=L.liteNextStageInfo();I('lite-next').textContent=next.won?'完成本局':roll?.route==='rest'&&roll.settled?`进入第 ${next.stage+1} 关`:'下一关';
  I('lite-reward-title').textContent=comboPending?roll.combo.name+' · 自选奖励':entered?route.name:`第 ${L.stage+1} 关通过！`;
  I('dialog-tag').textContent=comboPending?'隐藏大奖 · 额外奖励':entered?'幸运抵达 · '+route.name:'关卡完成 · 三骰定去向';
  I('lite-dice-total').hidden=entered||!roll;
  I('lite-reward-summary').hidden=page==='dice';
  I('lite-dice-total').textContent=roll?`总点数 ${roll.total}`:'三颗混合骰子';
  liteShowDiceCombo(roll);
  I('lite-refresh-dice').hidden=entered;I('lite-refresh-dice').disabled=liteRolling||(L.lite.diceRefreshes??1)<=0;
  I('lite-refresh-dice').textContent=(L.lite.diceRefreshes??1)>0?'换一组骰子 · 免费 1 次':'本关刷新已用完';
  liteSyncRouteCarousel(roll);
  const box=I('lite-buff-choices'),item=I('lite-reward-item');box.replaceChildren();item.replaceChildren();item.hidden=true;
  const extra=I('lite-extra-reward');extra.replaceChildren();extra.hidden=true;
  const comboLoot=I('lite-combo-loot');comboLoot.hidden=true;comboLoot.replaceChildren();
  I('lite-choice-refresh').hidden=true;
  if(!roll){I('lite-reward-summary').textContent='区间随骰型调整 · 四类奖励机会接近';I('lite-roll').textContent='投掷';return;}
  if(!entered){I('lite-reward-summary').textContent=`前往${route.name}`;I('lite-enter').textContent=roll.combo?.choiceCount?'领取大奖':`进入${route.name}`;return;}
  I('lite-next').disabled=!roll.settled||comboPending;
  if(comboPending){
    I('lite-reward-summary').hidden=true;extra.hidden=false;
    renderLiteComboReward(extra,{game:L,icon:liteIcon,tool:liteTool,buff:liteBuff,act(fn){
      if(!fn())return false;se.play('clear');liteUpdateReward();liteSync();d3();liteSaveSafe();I('lite-reward-title').focus({preventScroll:true});return true;
    }});return;
  }
  I('lite-reward-summary').textContent=roll.legacyClaimed?(roll.settled?'本关旧版奖励已领取，下关开始按总和前往奖励地点。':'选完上次保留的 Buff，下关开始按总和前往奖励地点。'):`通关补给 · 金币 +${roll.coins}`;
  if(roll.legacyClaimed&&roll.settled)return;
  if(['exchange','gamble','rest','jackpot'].includes(roll.route)){
    extra.hidden=false;
    renderLiteExtraReward(extra,{game:L,icon:liteIcon,tool:liteTool,buff:liteBuff,act(fn){
      if(!fn())return false;se.play('clear');liteUpdateReward();liteSync();d3();liteSaveSafe();
      if(L.lite.roll?.settled)I('lite-next').focus({preventScroll:true});return true;
    }});
  }
  if(roll.route==='buff'){
    if(!roll.buffOptions.length)I('lite-reward-summary').textContent='Buff 已集齐，奖励转为金币 · 共 +'+roll.coins;
    else if(roll.chosenBuff)I('lite-reward-summary').textContent=roll.convertedCoins?`已拥有 ${liteBuff(roll.chosenBuff).name} · 转为 ${roll.convertedCoins} 金币`:'已获得 '+liteBuff(roll.chosenBuff).name+' · 金币 +'+roll.coins;
    if(!roll.settled)for(const id of roll.buffOptions){const b=liteBuff(id),button=document.createElement('button'),owned=L.lite.buffs.includes(id);button.className='lite-buff-option upgrade-button';button.dataset.upgrade=id;button.dataset.buffTone=v6(1);button.disabled=!!roll.adReadyAt;button.innerHTML='<strong></strong><span></span>';button.querySelector('strong').textContent=b.name;button.querySelector('span').textContent=owned?'已拥有 · 选择后转为 5 金币':b.description;button.onclick=()=>{if(L.liteChooseBuff(id)){liteUpdateReward();liteSync();d3();liteSaveSafe();}};box.append(button);}
  }
  if(roll.route==='tool'){
    if(roll.settled){
      const kind=roll.chosenTool||Object.keys(roll.tools).find(id=>roll.tools[id]);item.hidden=false;item.innerHTML=liteIcon(kind)+'<strong></strong><p></p>';item.querySelector('strong').textContent=liteToolName(kind)+' +1';item.querySelector('p').textContent='已放入下一关道具栏。'+(liteTool(kind)?.description||'');
    }else{
      I('lite-reward-summary').textContent='选择一个道具 · 通关金币 +'+roll.coins;
      for(const id of roll.toolOptions||[]){
        const tool=liteTool(id),button=document.createElement('button');button.type='button';button.className='lite-special-option lite-tool-option';button.dataset.tool=id;
        button.innerHTML='<span class="lite-block-medallion">'+liteIcon(id)+'</span><strong></strong><span class="lite-choice-description"></span>';
        button.querySelector('strong').textContent=tool.name+' +1';button.querySelector('.lite-choice-description').textContent=tool.description;
        button.onclick=()=>{if(L.liteChooseTool(id)){liteUpdateReward();liteSync();d3();liteSaveSafe();I('lite-next').focus({preventScroll:true});}};box.append(button);
      }
    }
  }
  if(roll.route==='special'){
    if(roll.settled){
      const special=liteSpecial(roll.specialKind);item.hidden=false;item.innerHTML=(special?liteBlockIcon(special.id):'')+'<strong></strong><p></p>';item.querySelector('strong').textContent=special?special.name+' +1':'本关奖励已领取';item.querySelector('p').textContent='已放入下一关道具栏，点击可改造当前下落块。';
    }else for(const id of roll.specialOptions||[]){
      const block=liteSpecial(id),button=document.createElement('button');button.className='lite-special-option';button.dataset.special=id;button.disabled=!!roll.adReadyAt;button.innerHTML='<span class="lite-block-medallion">'+liteBlockIcon(id)+'</span><strong></strong><span class="lite-choice-description"></span>';button.querySelector('strong').textContent=block.name+' +1';button.querySelector('.lite-choice-description').textContent=block.description;button.onclick=()=>{if(L.liteChooseSpecial(id)){liteUpdateReward();liteSync();d3();liteSaveSafe();}};box.append(button);
    }
  }
  if(['buff','special'].includes(roll.route)&&!roll.settled){I('lite-reward-summary').textContent='选择一项奖励 · 通关金币 +'+roll.coins;I('lite-choice-refresh').hidden=false;liteUpdateRefresh();}
  I('lite-shop-wallet').textContent=`持有 ${L.lite.coins} 金币`;
  const selectedCategory=roll.shopCategory||'all';
  for(const button of I('lite-shop-categories').children)button.setAttribute('aria-pressed',String(button.dataset.category===selectedCategory));
  I('lite-shop-empty').hidden=roll.route!=='shop'||(roll.shopOffers||[]).some(o=>selectedCategory==='all'||o.kind===selectedCategory);
  const shop=I('lite-shop-offers');shop.replaceChildren();
  if(roll.route==='shop')for(const offer of roll.shopOffers||[]){
    const name=offer.kind==='tool'?liteToolName(offer.item):offer.kind==='buff'?liteBuff(offer.item).name:liteConfig.specials.find(b=>b.id===offer.item).name;
    const owned=offer.kind==='buff'&&L.lite.buffs.includes(offer.item);
    const category={tool:'道具',buff:'Buff',special:'特殊方块'}[offer.kind];
    const button=document.createElement('button');button.type='button';button.className='lite-shop-buy';button.dataset.slot=offer.slot;button.dataset.kind=offer.kind;button.dataset.sold=String(offer.sold);
    button.hidden=selectedCategory!=='all'&&offer.kind!==selectedCategory;
    if(offer.kind==='buff'){button.classList.add('upgrade-button');button.dataset.upgrade=offer.item;}
    button.innerHTML='<strong></strong><span class="lite-shop-category"></span><span class="lite-shop-art">'+(offer.kind==='tool'?liteIcon(offer.item):offer.kind==='special'?'<span class="lite-block-medallion">'+liteBlockIcon(offer.item)+'</span>':'')+'</span><span class="lite-shop-price"></span>';
    button.querySelector('.lite-shop-category').textContent=category;
    button.querySelector('strong').textContent=name+(offer.kind!=='buff'?' +1':'');button.querySelector('.lite-shop-price').textContent=offer.sold?'已售罄':owned?'已拥有':`${offer.price} 金币`;
    button.disabled=offer.sold||owned;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','lite-shop-detail');
    const description=offer.kind==='buff'?liteBuff(offer.item).description:offer.kind==='special'?'改造当前下落块。'+liteSpecial(offer.item).description:liteTool(offer.item).description;
    button.title=category+' · '+description;button.setAttribute('aria-label',`${category}，${name}，${button.querySelector('.lite-shop-price').textContent}。${description}`);
    button.onclick=event=>liteOpenShopDetail(offer,button,event);
    shop.append(button);
  }

  if(roll.combo?.claimed){
    const c=roll.combo,summary=document.createElement('summary'),copy=document.createElement('div');
    summary.textContent=c.name+'大奖已领取 · 查看奖励';
    const items=[`${c.coins+(c.convertedCoins||0)} 金币`,...(c.toolIds||[]).map(id=>liteToolName(id)+' ×1'),...(c.buffIds||[]).map(id=>liteBuff(id)?.name||id)];
    for(const key of c.choiceKeys||[]){const o=c.choiceOptions?.find(o=>o.key===key);if(o)items.push('自选：'+(o.kind==='coin'?o.amount+' 金币':o.kind==='buff'?liteBuff(o.item)?.name:liteToolName(o.item)));}
    copy.textContent=items.join(' · ');comboLoot.append(summary,copy);comboLoot.hidden=false;
  }
}
function liteUpdateRefresh(){
  const r=L.lite.roll;if(!r||!I('lite-refresh-reward'))return;
  const button=I('lite-refresh-reward'),free=r.freeRefreshes??1,ads=r.adRefreshes??3,waiting=!!r.adReadyAt;
  button.disabled=waiting||(!free&&!ads)||r.settled;
  liteText(button,waiting?'观看中…':free?'免费刷新':ads?'看广告刷新':'刷新次数已用完');
  liteText(I('lite-refresh-status'),waiting?`等待 ${Math.max(0,Math.ceil((r.adReadyAt-Date.now())/1000))} 秒后刷新`:`免费 ${free} 次 · 广告 ${ads} 次`);
}
function liteShowReward(){
  liteCreateReward();if(liteRewardStage===L.stage&&!liteRewardPanel.hidden)return;
  liteRewardStage=L.stage;Ht('','','','');I('overlay').dataset.liteReward='true';I('game-ui').inert=true;I('game-ui').setAttribute('aria-hidden','true');
  liteRewardPanel.hidden=false;I('lite-reward-title').textContent=`第 ${L.stage+1} 关通过！`;
  I('overlay').querySelector('.dialog').setAttribute('aria-labelledby','lite-reward-title');I('overlay').querySelector('.dialog').removeAttribute('aria-describedby');
  liteDice.show(liteFaces(L.lite.roll));liteUpdateReward();liteSaveSafe();I(!L.lite.roll?'lite-roll':L.lite.roll.entered?'lite-next':'lite-enter').focus({preventScroll:true});
}
Qt=function(){
  if(G0||me.active||Ie.busy||Vt||pe.particles.length||k0)return;
  if(['checkpoint-complete','level-complete'].includes(L.phase)){liteShowReward();return;}
  if(L.phase==='lost'||L.phase==='won'){
    if(I('overlay').dataset.liteEnd===L.phase&&!I('overlay').hidden)return;
    liteCloseReward();const won=L.phase==='won';let best=0;try{best=Number(localStorage.getItem('rotationLiteBest')||0);if(L.score>best){best=L.score;localStorage.setItem('rotationLiteBest',String(best));}O9(localStorage);}catch{}
    Ht(won?'这次旋转，圆满通关。':'再转一次，会更好。',`${won?'全部小关已完成。':L.reason||'本局已结束。'}\n本局得分 ${Ne(L.score)} · 最佳 ${Ne(best)}\n${won?'':'已到达第 '+(L.stage+1)+' 关。\n'}金币和道具仅在本局有效。`,'再玩一局',won?'RUN COMPLETE':'TRY AGAIN');I('overlay').dataset.liteEnd=L.phase;I('game-ui').inert=true;return;
  }
  if(L.phase==='play'&&!L.stageCommitted)L.beginStage();
};
const liteOriginalHt=Ht;
Ht=function(...args){liteCloseReward();delete I('overlay').dataset.liteEnd;return liteOriginalHt(...args);};
I('start').onclick=event=>{
  if(!he&&!Qe)g5=false;
  if(me.active)return;se.unlock();
  if(G0){$9();return;}
  if(!he&&Qe){Gf();return;}
  if(['checkpoint-complete','level-complete'].includes(L.phase)&&he)return;
  z6({mode:he?'fluid':'submerge',element:event.currentTarget,event,kicker:'旋轴填形 · 三骰补给',title:'第 1 关',palette:l5[0],swap:()=>ka(true)});
};
I('help').onclick=()=>{if(me.active||!he||k0||Ie.busy||L.phase!=='play')return;G0=true;_t();se.pause();Ht('转一转，填满这一圈。','填满轮廓得分，达到本关目标后过关。放弃方块落空不扣投放次数，但会消耗落空容错。无尽模式沿用原版多种轮廓，持续挑战后续关卡。\n\n特殊方块也是道具：落地前点击右侧图标，将当前块改造为对应材质，形状保持不变。未使用的道具会保留到后续关卡，通关奖励和商店购买的道具会叠加到库存。\n\n道具补给随机展示三个不同道具，选择一个用于下一关。每次从八类地点中抽取四个，老四类总体占三分之二，新四类占三分之一，大成功约 2%。置换工坊交换库存道具；幸运赌桌可收手或冒险翻倍；休息站跳过下一关并获得该关目标分数、金币和随机 Buff；大成功从奖励池自选三项。三骰同点为豹子，奖励 30 金币、2 件道具和 1 个 Buff；点数连续为顺子，奖励 20 金币和 1 件道具，顺序不限。另有四种隐藏组合，命中后揭晓；稀有组合还能额外自选奖励。进入奖励页时领取，换骰会替换未领取的奖励。混合骰子的奖励区间随当前骰型调整；投掷前后共用一次免费换骰，进入奖励页后不能换。方块改造、Buff 奖励也为三选一，免费刷新 1 次，之后最多广告刷新 3 次。目前每次等待 2 秒模拟广告。Buff 本局有效，已拥有的选项可转为 5 金币。\n\n商店每次 8 个随机货位，可按方块、道具、Buff 分类查找。有效转轴旋转有小概率掉落道具。\n\n方向键 / A、D：移动；R / ↑：旋转；空格：投放。','继续游戏','怎么玩');I('game-ui').inert=true;};
// Lightweight saves retain the existing game object, with their own namespace.
P6=function(text){const value=JSON.parse(text,Lf),g=value?.game;if(value?.version!=='lite-1'||!g?.lite||!Array.isArray(g.board)||!['play','checkpoint-complete','lost','won'].includes(g.phase)||!Number.isInteger(g.stage)||g.stage<0||(!g.endless&&g.stage>=5))throw Error('轻量版存档无效');if(g.lite.roll&&!g.lite.roll.route){const old=g.lite.roll,total=old.values.reduce((sum,n)=>sum+n,0),pending=old.buffOptions?.length&&!old.chosenBuff;g.lite.roll={values:old.values,total,route:pending?'buff':liteConfig.rewardRoutes.find(r=>total>=r.min&&total<=r.max).id,entered:true,settled:!pending,legacyClaimed:true,coins:0,tools:{shovel:0,swap:0},buffOptions:pending?old.buffOptions:[],specialKind:null};}g.lite.tools={...Object.fromEntries(liteConfig.tools.map(t=>[t.id,0])),...g.lite.tools};g.lite.extraDrops??=0;if(!g.lite.specialToolsMigrated){for(const id of g.lite.specials||[])if(liteSpecial(id))g.lite.tools['block-'+id]=(g.lite.tools['block-'+id]||0)+1;g.lite.specialToolsMigrated=true;}g.lite.specials=[];g.lite.nextEffect=null;
const probe=new e9(42);Object.assign(probe,g);const r=g.lite.roll;
if(!Array.isArray(g.lite.routeChoices)&&g.phase==='checkpoint-complete')g.lite.routeChoices=r?.routes||['shop','tool','buff','special'];
g.lite.diceRefreshes??=1;if(r){r.sides??=[8,8,8];g.lite.diceSides=[...r.sides];}
if(r){r.freeRefreshes??=1;r.adRefreshes??=3;r.adReadyAt??=null;if(r.route==='special'&&!Array.isArray(r.specialOptions)){if(r.entered)r.settled=true;else{r.specialOptions=probe.liteRewardOptions('special');r.specialKind=null;r.settled=false;}}
if(r.route==='tool'&&!Array.isArray(r.toolOptions)){if(r.entered){r.toolOptions=[];r.chosenTool=Object.keys(r.tools||{}).find(id=>r.tools[id])||null;r.settled=true;}else{r.toolOptions=probe.liteRewardOptions('tool');r.tools=Object.fromEntries(liteConfig.tools.map(t=>[t.id,0]));r.chosenTool=null;r.settled=false;}}
}

if(g.lite.roll?.route==='shop'&&!g.lite.roll.legacyClaimed&&!Array.isArray(g.lite.roll.shopOffers))g.lite.roll.shopOffers=probe.liteCreateShop();if(!probe.valid(probe.board,[])||probe.active&&!probe.valid(probe.cells()))throw Error('轻量版棋盘无效');return value;};
jr=function(storage,game,fallTime){if(!['play','checkpoint-complete','lost','won'].includes(game.phase)||game.events.length||k0||Ie.busy)throw Error('等待棋盘结算');const text=JSON.stringify({version:'lite-1',savedAt:Date.now(),fallTime,game},Jr);P6(text);storage.setItem(o5,text);};
Qr=function(game,value){const saved=P6(JSON.stringify(value,Jr));Object.assign(game,saved.game);return Math.min(.8,saved.fallTime||0);};
function liteSaveSafe(){try{if(he&&!k0&&!Ie.busy&&['play','checkpoint-complete'].includes(L.phase))jr(localStorage,L,yt);}catch{}}
f5=function(){Qe=null;N3=false;try{Qe=I6(localStorage);}catch{I('home-save-summary').textContent='轻量版存档无法读取，可以重新开始。';}
  I('start').innerHTML=Df;const label=I('start').querySelector('.home-start-content > span');if(label)label.textContent=Qe?'继续轻量版':'开始轻量版';I('start').setAttribute('aria-label',Qe?'继续轻量版':'开始轻量版');I('start').disabled=false;I('home-new-run').hidden=!Qe;
  if(Qe)I('home-save-summary').textContent=`已保存 · ${Qe.game.endless?'无尽模式 · ':''}第 ${Qe.game.stage+1} 关 · ${Qe.game.score} 分`;else I('home-save-summary').textContent='三骰补给 · 特殊落块 · 转轴好运';
};
m5=true;pa();z3.hidden=false;z3.textContent='无尽模式';
const liteOriginalB6=B6;
B6=function(){liteCloseReward();liteRewardStage=-1;liteRolling=false;liteOriginalB6();};
const liteOriginalGf=Gf;
Gf=function(){liteRewardStage=-1;liteOriginalGf();liteSync();};
// Replace removed collection entry with concise rules, preserving home controls.
I('home-library-open').textContent='玩法';I('home-library-open').onclick=()=>{
 const dialog=I('home-library');dialog.querySelector('h2').textContent='轻量版玩法';dialog.querySelector('p').textContent='接上轴心 → 填形得分 → 达到目标 → 三骰补给';dialog.querySelector('nav').replaceChildren();dialog.querySelector('.library-list').innerHTML='<p>填满轮廓获得分数，达到目标通关。五关挑战和无尽模式共用原版多种轮廓。</p><p>每关从四面、六面、八面、十二面骰中随机生成三颗。每次展示四个地点，奖励区间随组合调整。商店、道具补给、Buff、方块改造总体占三分之二；置换工坊、幸运赌桌、休息站、大成功总体占三分之一，大成功约 2%。按总点数前往对应地点。休息站跳过下一关并获得目标分数、金币和随机 Buff，大成功从奖励池自选三项。每关可免费换一组，投掷前后共用一次，进入奖励页后不能刷新。道具补给三选一。方块改造和 Buff 也为三选一，每次免费刷新一次，之后可广告刷新三次。</p><p>所有方块改造均在道具栏使用，落地前改变当前块的材质和效果。剩余道具可带到后续关卡，通关奖励和商店购买的道具会叠加到库存。Buff 本局有效。</p><p>手机使用屏幕按钮；电脑使用方向键、R 和空格。</p>';dialog.showModal();};
I('home-library').querySelector('[data-close]').onclick=()=>I('home-library').close();
const homeBadge=document.createElement('span');homeBadge.className='lite-home-badge';homeBadge.textContent='轻量副本 · 三骰补给';I('overlay').append(homeBadge);
function liteFrame(){if(he){liteSync();liteAnimateRouteCarousel(performance.now());litePlayPendingAcquisition();if(L.lite.roll?.adReadyAt){if(L.liteFinishRewardAd()){d3();liteUpdateReward();liteSaveSafe();se.play('turn');}else liteUpdateRefresh();}}}
// Deterministic fixture access is only present with the explicit QA query flag.
if(new URLSearchParams(location.search).has('qa')){
  window.__liteQA={game:L,action:H6,specialVisuals:()=>liteBlockFx.snapshot(),refresh:()=>{H3=-1;V3();d3();Qt();},get paused(){return G0;},set paused(value){G0=value;},set naturalFall(value){liteNaturalFall=value;},get busy(){return !!k0||Ie.busy||!!pe.particles.length||me.active;},screenCell(x,y){const rect=I('stage').getBoundingClientRect(),p=new U(x,y,0).project(Bt);return{x:rect.left+I('stage').clientLeft+(p.x+1)*Ge.w/2,y:rect.top+I('stage').clientTop+Ge.top+(1-p.y)*Ge.playHeight/2};},start(){ka(true);},settle(){for(let i=0;i<100;i++){if(L.phase==='rotating')L.finishRotation();else if(L.phase==='clearing')L.finishClear();else if(L.phase==='settling')L.finishSettlement();else break;}L.events=[];k0=null;Ie.reset();pe.reset();V3();Qt();},renderer:de};
  window.__THREE_GAME_TEST_HOOKS__={
    async setState(name){
      if(!['active-play','reward','failure'].includes(name))throw Error('Unknown state '+name);
      ka(true);liteNaturalFall=false;
      const paths=[Array(12).fill('down'),[...Array(10).fill('down'),'rotate'],['right','right',...Array(10).fill('down'),'rotate','down','down'],['left',...Array(11).fill('down'),'rotate','down','rotate','rotate','down']];
      for(const path of paths.slice(0,name==='reward'?4:3)){for(const action of path)action==='rotate'?L.rotatePiece():L.move(action==='left'?-1:action==='right'?1:0,action==='down'?-1:0);L.drop();window.__liteQA.settle();}
      if(name==='reward'){for(let i=0;L.phase==='play'&&i<20;i++){L.board=L.target.cells.map(c=>({...c,id:L.id++,type:'L'}));L.checkClear();window.__liteQA.settle();}liteShowReward();L.liteRoll();d3();liteDice.show(liteFaces(L.lite.roll));liteUpdateReward();}
      if(name==='failure'){L.dropsUsed=L.dropLimit;L.checkDropLimit();d3();Qt();}
      await new Promise(resolve=>setTimeout(resolve,1100));return {state:name};
    },
    setPausedForScreenshot(value){G0=value;},
  };
  Object.defineProperty(window,'__THREE_GAME_DIAGNOSTICS__',{get(){return {phase:L.phase,level:L.stage+1,renderer:{calls:de.info.render.calls,triangles:de.info.render.triangles,geometries:de.info.memory.geometries,textures:de.info.memory.textures},dpr:de.getPixelRatio()};}});
}
