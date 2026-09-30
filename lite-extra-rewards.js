/* Destination screens read model state and dispatch explicit player choices. */
(function(root){
  'use strict';
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function button(text,action,secondary=false){const n=node('button','lite-extra-button'+(secondary?' is-secondary':''),text);n.type='button';n.onclick=action;return n;}
  function art(route){const n=node('img','lite-extra-emblem');n.src='./assets/icons/route-'+route+'.svg';n.alt='';n.width=80;n.height=80;return n;}
  function note(host,text){host.append(node('p','lite-extra-note',text));}
  function receipt(host,title,description){const box=node('div','lite-extra-receipt');box.setAttribute('role','status');box.append(node('strong','',title));if(description)box.append(node('p','',description));host.append(box);}
  root.renderLiteExtraReward=function(host,{game,icon,tool,buff,act}){
    const roll=game.lite.roll,route=roll?.route;
    if(!['exchange','gamble','rest','jackpot'].includes(route))return false;
    const screen=node('section','lite-extra-screen');screen.dataset.destination=route;host.append(screen);
    const header=node('div','lite-extra-heading');header.append(art(route));screen.append(header);
    if(route==='exchange'){
      if(roll.settled){
        const trade=roll.chosenExchange;
        receipt(screen,trade?'置换完成':'保留现有道具',trade?`${tool(trade.give)?.name||trade.give} −1 → ${tool(trade.receive)?.name||trade.receive} +1`:'这次不置换，继续下一关。');return true;
      }
      note(screen,'交出 1 件道具，换取下方 1 件新道具。');
      const owned=Object.entries(game.lite.tools).filter(([,count])=>count>0);
      if(!owned.length){receipt(screen,'暂时没有可置换的道具','可以直接离开工坊。');screen.append(button('离开工坊',()=>act(()=>game.liteSkipExchange())));return true;}
      let give=null,receive=null;
      const payment=node('div','lite-extra-inventory'),offers=node('div','lite-extra-offers'),caption=node('p','lite-extra-selection','先选择要交出的道具');
      screen.append(node('h3','','交出道具'),payment,node('h3','','换取道具'),offers,caption);
      const confirm=button('确认置换',()=>act(()=>game.liteExchange(give,receive)));confirm.disabled=true;
      const sync=()=>{
        for(const el of payment.children)el.setAttribute('aria-pressed',String(el.dataset.item===give));
        for(const el of offers.children){el.setAttribute('aria-pressed',String(el.dataset.item===receive));el.disabled=el.dataset.item===give;}
        confirm.disabled=!give||!receive||give===receive;
        caption.textContent=!give?'先选择要交出的道具':!receive?'再选择想换取的道具':`${tool(give)?.name} → ${tool(receive)?.name}`;
      };
      for(const[id,count]of owned){const b=button('',()=>{give=id;if(receive===give)receive=null;sync();},true);b.classList.add('lite-extra-inventory-item');b.dataset.item=id;b.setAttribute('aria-pressed','false');b.innerHTML=icon(id);b.append(node('span','',tool(id)?.name||id),node('b','lite-extra-count','×'+count));payment.append(b);}
      for(const id of roll.exchangeOptions||[]){const b=button('',()=>{receive=id;sync();},true);b.classList.add('lite-extra-offer');b.dataset.item=id;b.setAttribute('aria-pressed','false');b.innerHTML=icon(id);b.append(node('strong','',tool(id)?.name||id),node('small','',tool(id)?.description||''));offers.append(b);}
      const actions=node('div','lite-extra-actions');actions.append(button('暂不置换',()=>act(()=>game.liteSkipExchange()),true),confirm);screen.append(actions);return true;
    }
    if(route==='gamble'){
      const wager=roll.gamble;
      if(!wager){note(screen,'赌桌准备中');return true;}
      const die=node('div','lite-extra-die',wager.lastDie===null?'?':String(wager.lastDie));die.setAttribute('aria-label',wager.lastDie===null?'六面骰子':`本次骰子 ${wager.lastDie} 点`);header.append(die);
      if(roll.settled){receipt(screen,wager.lost?'本次奖池已失去':`已领取 ${wager.collected} 金币`,wager.lost?'通关金币和已有道具均已保留。':'奖励已存入金币余额。');return true;}
      const pot=node('div','lite-extra-pot');pot.append(node('small','','当前奖池'),node('strong','',wager.pot+' 金币'));screen.append(pot);
      note(screen,'六面骰子掷出 4–6 点，奖池翻倍；1–3 点失去当前奖池。');
      screen.append(node('p','lite-extra-meta',`已投掷 ${wager.attempts} / ${wager.maxAttempts} 次 · 可随时领取`));
      if(wager.lastDie!==null)receipt(screen,`${wager.lastDie} 点 · `+(wager.lost?'本次奖池已失去':'奖池翻倍'));
      const actions=node('div','lite-extra-actions');const reroll=button('再掷一次',()=>{
        if(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches){act(()=>game.liteGamble());return;}
        for(const b of screen.querySelectorAll('button'))b.disabled=true;
        die.textContent='?';die.classList.add('is-rolling');die.setAttribute('aria-label','正在投掷');
        setTimeout(()=>{if(screen.isConnected&&game.lite.roll===roll)act(()=>game.liteGamble());},380);
      },true);reroll.disabled=wager.lost||wager.attempts>=wager.maxAttempts;
      actions.append(reroll,button(wager.lost?'继续':'领取 '+wager.pot+' 金币',()=>act(()=>game.liteCollectGamble())));screen.append(actions);note(screen,'只押当前奖池，不扣除通关金币或库存道具。');return true;
    }
    if(route==='rest'){
      const rest=roll.rest;
      if(!rest){note(screen,'休息站准备中');return true;}
      const restBuff=rest.buff?(buff(rest.buff)?.name||rest.buff):null;
      const rewards=`${rest.score} 分 · ${rest.coins} 金币`+(restBuff?' · '+restBuff:rest.convertedCoins?' · Buff 已集齐，额外 '+rest.convertedCoins+' 金币':'');
      if(rest.claimed||roll.settled){receipt(screen,`第 ${rest.stage+1} 关已跳过`,rewards);return true;}
      const value=node('div','lite-extra-pot');value.append(node('small','','跳过下一关'),node('strong','',`第 ${rest.stage+1} 关`));screen.append(value);
      note(screen,'直接领取下一关的分数与通关奖励。');
      receipt(screen,`${rest.score} 分 · ${rest.coins} 金币`,restBuff?'随机 Buff：'+restBuff:rest.convertedCoins?'Buff 已集齐，额外获得 '+rest.convertedCoins+' 金币':'');
      if(restBuff)note(screen,buff(rest.buff)?.description||'');
      screen.append(button('休息并领取奖励',()=>act(()=>game.liteRest())));return true;
    }
    const options=roll.jackpotOptions||[];
    const optionName=o=>o.kind==='coin'?o.amount+' 金币':o.kind==='buff'?(buff(o.item)?.name||o.item):(tool(o.item)?.name||o.item);
    if(roll.settled){
      receipt(screen,'大成功奖励已领取',(roll.jackpotChosen||[]).map(key=>options.find(o=>o.key===key)).filter(Boolean).map(optionName).join(' · '));return true;
    }
    renderCatalogue(screen,{options,count:3,label:'大成功',icon,tool,buff,act,claimChoice:keys=>game.liteClaimJackpot(keys)});
    return true;
  };
  function renderCatalogue(screen,{options,count,label,icon,tool,buff,act,claimChoice}){
    const optionName=o=>o.kind==='coin'?o.amount+' 金币':o.kind==='buff'?(buff(o.item)?.name||o.item):(tool(o.item)?.name||o.item);
    note(screen,`从全部奖励中任选 ${count} 项。`);
    const selected=new Set(),counter=node('p','lite-extra-selection',`已选 0 / ${count} 项`),catalog=node('div','lite-extra-catalog');
    const categories=[['all','全部'],['coin','金币'],['tool','道具'],['special','方块'],['buff','Buff']];
    const categoryOf=o=>o.kind==='tool'&&tool(o.item)?.blockEffect?'special':o.kind;
    const tabs=node('nav','lite-jackpot-tabs');tabs.setAttribute('aria-label','奖励分类');
    const empty=node('p','lite-jackpot-empty','此分类暂无可领取奖励');empty.hidden=true;
    let category='all';
    const filter=()=>{
      for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.category===category));
      for(const b of catalog.children)b.hidden=category!=='all'&&b.dataset.category!==category;
      empty.hidden=options.some(o=>category==='all'||categoryOf(o)===category);catalog.scrollTop=0;
    };
    for(const[id,label]of categories){const tab=button(label,()=>{category=id;filter();},true);tab.dataset.category=id;tabs.append(tab);}
    catalog.setAttribute('aria-label',label+'奖励目录');
    const claim=button(`领取 ${count} 项奖励`,()=>act(()=>claimChoice([...selected])));claim.disabled=true;
    const sync=()=>{counter.textContent=`已选 ${selected.size} / ${count} 项`;claim.disabled=selected.size!==count;for(const b of catalog.children){const picked=selected.has(b.dataset.reward);b.setAttribute('aria-pressed',String(picked));b.disabled=selected.size===count&&!picked;b.querySelector('.lite-jackpot-pick').textContent=picked?'已选 · 点击取消':'选择此项';}};
    for(const option of options){
      const b=button('',()=>{if(selected.has(option.key))selected.delete(option.key);else if(selected.size<count)selected.add(option.key);sync();},true);
      b.classList.add('lite-extra-catalog-item');b.dataset.reward=option.key;b.dataset.category=categoryOf(option);b.setAttribute('aria-pressed','false');
      const glyph=node('span','lite-extra-catalog-icon');
      if(option.kind==='tool')glyph.innerHTML=icon(option.item);
      else if(option.kind==='buff'){const img=art('buff');glyph.append(img);}
      else{glyph.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true" shape-rendering="crispEdges"><path fill="#3454f7" d="M8 2h16v4h4v4h4v12h-4v4h-4v4H8v-4H4v-4H0V10h4V6h4z"/><path fill="#c4ff17" d="M10 6h12v4h4v12h-4v4H10v-4H6V10h4z"/><path fill="#fff" d="M14 10h4v12h-4z"/></svg>';}
      const description=option.kind==='coin'?'存入金币余额':option.kind==='buff'?(buff(option.item)?.description||'获得本局强化'):(tool(option.item)?.description||'获得 1 件道具');
      b.append(node('strong','lite-jackpot-name',optionName(option)),glyph,node('small','lite-jackpot-description',description),node('span','lite-jackpot-pick','选择此项'));catalog.append(b);
    }
    const footer=node('div','lite-jackpot-footer');footer.append(counter,claim);screen.append(tabs,empty,catalog,footer);filter();
    return true;
  }

  root.renderLiteComboReward=function(host,{game,icon,tool,buff,act}){
    if(!game.liteComboNeedsChoice())return false;
    const roll=game.lite.roll,combo=roll.combo;
    const screen=node('section','lite-extra-screen lite-combo-choice-screen');screen.dataset.destination='jackpot';host.append(screen);
    const granted=[];
    if(combo.coins)granted.push(combo.coins+' 金币');
    for(const id of combo.toolIds||[])granted.push(tool(id)?.name||id);
    for(const id of combo.buffIds||[])granted.push(buff(id)?.name||id);
    if(combo.convertedCoins)granted.push('Buff 折算 '+combo.convertedCoins+' 金币');
    if(granted.length){
      const earned=node('p','lite-combo-earned');earned.setAttribute('role','status');
      earned.append(node('strong','','已获得：'),document.createTextNode(granted.join(' · ')));screen.append(earned);
    }
    const routeName=roll.routeName||game.liteRewardRanges().find(r=>r.id===roll.route)?.name||'奖励地点';
    note(screen,'选完后继续前往'+routeName);
    renderCatalogue(screen,{options:combo.choiceOptions||[],count:combo.choiceCount,label:combo.name,icon,tool,buff,act,claimChoice:keys=>game.liteClaimCombo(keys)});
    return true;
  };

})(globalThis);
