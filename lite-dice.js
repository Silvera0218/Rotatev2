/* Crystal dice; types, values and rewards come exclusively from the model. */
(() => {
 'use strict';
 const glyphs={
  '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],
  '2':['110','001','111','100','111'],'3':['110','001','010','001','110'],
  '4':['101','101','111','001','001'],'5':['111','100','110','001','110'],
  '6':['011','100','111','101','111'],'7':['111','001','010','010','010'],
  '8':['111','101','111','101','111'],'9':['111','101','111','001','110'],
  '?':['110','001','010','000','010']
 };
 const styles={
  4:{name:'四面骰',light:'#8cf8ff',mid:'#0ac5ed',dark:'#0564c6',edge:'#074780',glint:'#d8ffff'},
  6:{name:'六面骰',light:'#f09bff',mid:'#b528ff',dark:'#4713b3',edge:'#381274',glint:'#f2d2ff'},
  8:{name:'八面骰',light:'#ffe09a',mid:'#ffa444',dark:'#b94727',edge:'#863a2f',glint:'#fff2c6'},
  12:{name:'十二面骰',light:'#b2bcff',mid:'#476af2',dark:'#3c199c',edge:'#272c7c',glint:'#daeeff'}
 };
 const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),sub=(a,b)=>a.map((n,i)=>n-b[i]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const unit=v=>{const length=Math.hypot(...v);return v.map(n=>n/length);};
 const center=points=>[0,1,2].map(i=>points.reduce((s,p)=>s+p[i],0)/points.length);
 const rotate=(p,x,y,z)=>{
  let[a,b,c]=p,t=b*Math.cos(x)-c*Math.sin(x);c=b*Math.sin(x)+c*Math.cos(x);b=t;
  t=a*Math.cos(y)+c*Math.sin(y);c=-a*Math.sin(y)+c*Math.cos(y);a=t;
  return[a*Math.cos(z)-b*Math.sin(z),a*Math.sin(z)+b*Math.cos(z),c];
 };
 const meshes=Object.fromEntries(Object.entries(LITE_DICE_GEOMETRY).map(([sides,raw])=>{
  const first=raw.faces[0].map(i=>raw.vertices[i]),apex=sides==='4'||sides==='8';
  const n=unit(apex?raw.vertices[raw.faces[0][0]]:center(first));
  const u=apex?unit(cross([0,0,1],n).some(x=>Math.abs(x)>.01)?cross([0,0,1],n):cross([0,1,0],n)):unit(sub(first[1],first[0])),v=cross(n,u);
  const vertices=raw.vertices.map(p=>[dot(p,u),dot(p,v),dot(p,n)]);
  const faces=raw.faces.map((indices,index)=>{
   const points=indices.map(i=>vertices[i]),c=center(points),normal=unit(c);
   let right=cross([0,1,0],normal);if(Math.hypot(...right)<.01)right=cross([0,0,1],normal);right=unit(right);
   const up=cross(normal,right),radius=Math.min(...points.map((p,i)=>{const edge=sub(points[(i+1)%points.length],p);return Math.hypot(...cross(sub(c,p),edge))/Math.hypot(...edge);}));
   return{indices,index,center:c,normal,right,up,radius};
  });return[sides,{vertices,faces}];
 }));
 globalThis.createLiteDice=function(host){
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
  const labels=document.createElement('div');labels.className='lite-dice-labels';labels.setAttribute('role','status');labels.setAttribute('aria-live','polite');
  const labelNodes=Array.from({length:3},()=>{const el=document.createElement('span');el.innerHTML='<b></b><small></small>';labels.append(el);return el;});
  host.replaceChildren(canvas,labels);const ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=300,height=200,raf=0,started=0,resolveRoll=null,disposed=false,progress=1;
  let values=[4,6,12].map(sides=>({sides,value:null}));
  function label(settled){labelNodes.forEach((el,i)=>{
   const die=values[i];el.dataset.sides=die.sides;el.dataset.value=settled&&die.value!==null?die.value:'';
   el.querySelector('b').textContent=styles[die.sides].name;
   el.querySelector('small').textContent=!settled?'投掷中…':die.value===null?`1–${die.sides} 点`:`${die.value} 点`;
  });}
  function path(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();}
  function number(value,face,front){
   const digits=String(value).split(''),cols=digits.length*4-1,unit=Math.min(face.radius*1.3/cols,face.radius*1.3/5);
   const draw=(dx,dy,color)=>{ctx.fillStyle=color;digits.forEach((digit,k)=>(glyphs[digit]||glyphs['?']).forEach((row,y)=>{for(let x=0;x<3;x++)if(row[x]==='1')ctx.fillRect((k*4+x-cols/2)*unit+dx,(y-2.5)*unit+dy,unit+.003,unit+.003);}));};
   draw(.022,.035,'#19346b99');draw(0,0,front?'#fff':'#d6dfff');
  }
  function paintFace(face,projected,angles,cx,cy,size,sides,value,p,frontIndex){
   const palette=styles[sides],points=face.indices.map(i=>projected[i]);path(points);ctx.save();ctx.clip();
   const c=rotate(face.center,...angles),u=rotate(face.right,...angles),v=rotate(face.up,...angles);
   ctx.transform(u[0]*size,-u[1]*size,-v[0]*size,v[1]*size,cx+c[0]*size,cy-c[1]*size);
   const gradient=ctx.createLinearGradient(-1,-1,1,1);gradient.addColorStop(0,palette.light);gradient.addColorStop(.42,palette.mid);gradient.addColorStop(1,palette.dark);
   ctx.fillStyle=gradient;ctx.fillRect(-2,-2,4,4);
   ctx.globalAlpha=.48;ctx.fillStyle=palette.glint;ctx.beginPath();ctx.moveTo(-1.2,-1);ctx.lineTo(.15,-.85);ctx.lineTo(-.48,.72);ctx.closePath();ctx.fill();
   ctx.globalAlpha=.35;ctx.fillStyle=palette.dark;ctx.beginPath();ctx.moveTo(.08,-1.2);ctx.lineTo(1.1,.62);ctx.lineTo(-.5,1);ctx.closePath();ctx.fill();
   for(let j=0;j<14;j++){
    const seed=(j*29+face.index*17+sides*11)%101,x=(seed%13-6)*.13,y=((seed*7)%13-6)*.13;
    ctx.globalAlpha=j%3===0?.52:.2;ctx.fillStyle=j%2?palette.glint:'#fff';ctx.fillRect(x,y,j%3===0?.105:.055,.055);
   }
   const light=rotate(face.normal,...angles)[2];ctx.globalAlpha=Math.max(0,.35*(1-light));ctx.fillStyle=palette.edge;ctx.fillRect(-2,-2,4,4);ctx.globalAlpha=1;
   const faceValue=value===null?'?':((value+face.index-frontIndex-1+sides)%sides)+1;
   number(faceValue,face,face.index===frontIndex);ctx.restore();
   path(points);ctx.lineJoin='round';ctx.lineWidth=1.5;ctx.strokeStyle=palette.edge;ctx.stroke();
   ctx.beginPath();ctx.moveTo(...points[0]);ctx.lineTo(...points[1]);ctx.lineWidth=1;ctx.strokeStyle=palette.glint;ctx.stroke();
  }
  function draw(){
   if(disposed||!ctx)return;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;
   const size=Math.min(width/7.1,(height-64)/2.1);
   canvas.dataset.phase=progress>=1?'settled':progress<.24?'toss':progress<.45?'fall':progress<.78?'impact':'lineup';
   // Broad, stepped contact wave sits under all three dice, as in the reference.
   if(progress>.43&&progress<.81){
    const t=(progress-.43)/.38,r=size*(.9+t*3.1),cell=6,cy=(height-42)*.55;
    ctx.globalAlpha=(1-t)*.72;
    for(let x=-r;x<=r;x+=cell)for(let y=-r*.46;y<=r*.46;y+=cell){
     const d=(x*x)/(r*r)+(y*y)/(r*r*.46*.46);
     if(d>.61&&d<1){ctx.fillStyle=d>.84?'#60ffff':'#1cdbe8';ctx.fillRect(Math.round(width/2+x),Math.round(cy+y),cell,cell);}
    }ctx.globalAlpha=1;
   }
   for(let die=0;die<3;die++){
    const{sides,value}=values[die],mesh=meshes[sides],p=progress>=1?1:Math.max(0,Math.min(1,(progress*1780-die*44)/1692));
    const ease=x=>1-(1-x)**3,scatter=p<.22?ease(p/.22):p<.78?1:1-ease((p-.78)/.22);
    const fall=Math.max(0,Math.min(1,(p-.22)/.22)),land=Math.max(0,(p-.44)/.34);
    const bounce=p>=.44&&p<.78?Math.abs(Math.sin(land*Math.PI*2))*size*.42*(1-land):0;
    const lift=p<.22?Math.sin(p/.22*Math.PI/2)*size*.6:p<.44?(1-fall*fall)*size*2.7:0;
    const motion=Math.pow(1-Math.min(1,Math.max(0,p-.18)/.66),2),finalX=width*(die+.5)/3,baseY=(height-42)*.55;
    const drift=p>=.44&&p<.78?Math.sin(land*Math.PI*2)*(1-land)*size*.3*(die===1?-1:1):0;
    const cx=finalX+(width/2+(die-1)*size*1.38-finalX)*scatter+drift,cy=baseY-lift-bounce+(die===1?-.23:.17)*size*scatter;
    const renderedSize=size*(1-scatter*.15),rock=p>=.44&&p<.84?Math.sin((p-.44)*54)*(1-(p-.44)/.4)*.18:0;
    const angles=[-.2+motion*(Math.PI*4+die*.5)+rock,-.24+motion*(Math.PI*6+die*.4),.48+motion*Math.PI*2+rock];
    const transformed=mesh.vertices.map(v=>rotate(v,...angles)),projected=transformed.map(v=>[cx+v[0]*renderedSize,cy-v[1]*renderedSize]);
    const airborne=Math.min(1,(lift+bounce)/(size*2));
    ctx.fillStyle=`rgba(40,66,126,${.19-airborne*.12})`;ctx.beginPath();ctx.ellipse(cx+4,baseY+size*.22,size*(.7-airborne*.28),size*(.49-airborne*.2),0,0,Math.PI*2);ctx.fill();
    if(p<.32&&progress<1){
      const t=Math.min(1,p/.25);ctx.globalAlpha=Math.sin(Math.min(1,p/.32)*Math.PI);
      for(let j=0;j<22;j++){
        const a=j*2.39996+t*1.8,r=size*(.22+t*.64)*(1+(j%3)*.13),s=j%4===0?7:4;
        ctx.fillStyle=j%3===0?'#fffbd6':j%3===1?'#ffe95b':'#ffc438';
        ctx.fillRect(Math.round(finalX+Math.cos(a)*r),Math.round(baseY+Math.sin(a)*r*.65-t*12),s,s);
      }ctx.globalAlpha=1;
    }
    if(p>=.44&&p<.93){
      const t=(p-.44)/.49;ctx.globalAlpha=1-t;
      for(let j=0;j<20;j++){
        const angle=j*Math.PI/10,radius=size*(.45+t*1.35),x=Math.round(cx+Math.cos(angle)*radius),y=Math.round(baseY+Math.sin(angle)*radius*.58-t*size*.3);
        ctx.fillStyle=j%4===0?'#ffde62':j%3===0?'#fff':j%2?'#50efff':styles[sides].light;ctx.fillRect(x,y,j%5===0?8:4,j%5===0?8:4);
      }ctx.globalAlpha=1;
    }
    const faces=mesh.faces.filter(f=>rotate(f.normal,...angles)[2]>.001).sort((a,b)=>rotate(a.center,...angles)[2]-rotate(b.center,...angles)[2]);
    const restAngles=[-.2,-.24,.48],frontIndex=mesh.faces.reduce((best,face)=>rotate(face.center,...restAngles)[2]>rotate(best.center,...restAngles)[2]?face:best).index;
    // Brief golden lift-out, then a solid falling die with readable fixed faces.
    const bodyAlpha=p<.22?Math.max(0,1-p/.15):1;
    ctx.save();ctx.globalAlpha=bodyAlpha;
    if(bodyAlpha>0)for(const face of faces)paintFace(face,projected,angles,cx,cy,renderedSize,sides,value,p,frontIndex);
    ctx.restore();
    if(p===1){ctx.fillStyle='#fff';ctx.fillRect(Math.round(cx-size*.35),Math.round(cy-size*.6),3,8);ctx.fillRect(Math.round(cx-size*.35)-3,Math.round(cy-size*.6)+3,9,3);}
   }
  }
  function resize(){const r=host.getBoundingClientRect();width=Math.max(1,Math.round(r.width||300));height=Math.max(1,Math.round(r.height||200));canvas.width=width;canvas.height=height;draw();}
  function finish(){if(raf)cancelAnimationFrame(raf);raf=0;progress=1;draw();label(true);const done=resolveRoll;resolveRoll=null;done?.();}
  function tick(now){progress=Math.min(1,(now-started)/1780);draw();if(progress<1)raf=requestAnimationFrame(tick);else finish();}
  function normalize(faces){return Array.from({length:3},(_,i)=>{const f=faces?.[i];return{sides:styles[f?.sides]?f.sides:8,value:Number.isInteger(f?.value)?f.value:null};});}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();label(true);
  const onReduced=()=>{if(reduced.matches&&raf)finish();};reduced.addEventListener('change',onReduced);
  return{
   roll(faces){if(disposed)return Promise.resolve();finish();values=normalize(faces);progress=0;label(false);resize();return new Promise(resolve=>{resolveRoll=resolve;if(reduced.matches)finish();else{started=performance.now();raf=requestAnimationFrame(tick);}});},
   show(faces){if(disposed)return;finish();values=normalize(faces);resize();label(true);},
   skip:finish,
   dispose(){if(disposed)return;finish();disposed=true;observer.disconnect();reduced.removeEventListener('change',onReduced);canvas.remove();labels.remove();}
  };
 };
})();
