const LAYOUTS=[
  {n:'1×2 vertical',c:1,r:2},{n:'1×2 horizontal',c:2,r:1},
  {n:'1×3 vertical',c:1,r:3},{n:'1×3 horizontal',c:3,r:1},
  {n:'Líneas verticales',c:4,r:1,a:0.4,lines:true},
  {n:'2×2',c:2,r:2},{n:'3×3',c:3,r:3},{n:'5×5',c:5,r:5},
  {n:'9×9',c:9,r:9},{n:'10×10',c:10,r:10}
];
// imgs[i] = {im, z (zoom 1-5), ox, oy (desplazamiento -1..1)}
let cur=LAYOUTS.find(l=>l.n==='2×2'), imgs={}, target=0, sel=null, G=null;
const $=id=>document.getElementById(id);
const grid=$('grid'), fileIn=$('file');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Historial para deshacer (copias del estado de las fotos)
let hist=[], gestT=0;
const upd=()=>{$('undo').disabled=!hist.length};
function push(){
  const s={};for(const k in imgs)s[k]={...imgs[k]};
  hist.push(s);if(hist.length>40)hist.shift();upd();
}
function undo(){if(!hist.length)return;imgs=hist.pop();upd();render()}

// Medidas del collage para un lado mayor L (px). cw/ch = ancho/alto de celda
function dims(L){
  const a=(cur.a||1)*$('str').value, c=cur.c, r=cur.r, g=$('gap').value/100*L;
  const cw=Math.min((L-(c+1)*g)/c, a*(L-(r+1)*g)/r), ch=cw/a;
  return {g,cw,ch,W:c*cw+(c+1)*g,H:r*ch+(r+1)*g};
}
// Posición y tamaño de la foto dentro de su celda (cubre la celda, con zoom y desplazamiento)
function fit(e,cw,ch){
  const im=e.im, s=Math.max(cw/im.naturalWidth,ch/im.naturalHeight)*e.z;
  const w=im.naturalWidth*s, h=im.naturalHeight*s, mx=(w-cw)/2, my=(h-ch)/2;
  return {w,h,mx,my,x:(cw-w)/2+e.ox*mx,y:(ch-h)/2+e.oy*my};
}
function place(el,e){
  const f=fit(e,G.cw,G.ch);
  el.style.cssText=`width:${f.w}px;height:${f.h}px;left:${f.x}px;top:${f.y}px`;
}

function buildOpts(){
  const box=$('opts');box.innerHTML='';
  LAYOUTS.forEach(l=>{
    const b=document.createElement('button');b.className='opt'+(l===cur?' on':'');
    const a=l.a||1, m=document.createElement('div');m.className='mini';
    const cw=Math.max(2,Math.min(32/l.c,a*32/l.r)-1);
    m.style.gridTemplateColumns=`repeat(${l.c},${cw}px)`;
    for(let i=0;i<l.c*l.r;i++){const e=document.createElement('i');e.style.height=cw/a+'px';m.appendChild(e)}
    b.append(m,l.n);
    b.onclick=()=>{cur=l;sel=null;$('linesRow').hidden=!l.lines;buildOpts();render()};
    box.appendChild(b);
  });
}

function mark(){
  [...grid.children].forEach((d,i)=>d.classList.toggle('sel',i===sel));
  const e=sel!==null&&imgs[sel];
  $('edit').hidden=!e;
  if(e)$('zoom').value=e.z;
}

// Mover (arrastrar), zoom (rueda / pellizco) y selección de una foto
function bindEdit(d,im,e,i){
  const P=new Map();let moved=0,d0=1,z0=1,pushed=false;
  const dist=()=>{const [a,b]=[...P.values()];return Math.hypot(a[0]-b[0],a[1]-b[1])||1};
  d.onpointerdown=ev=>{
    d.setPointerCapture(ev.pointerId);P.set(ev.pointerId,[ev.clientX,ev.clientY]);
    if(P.size===1){moved=0;pushed=false}
    if(P.size===2){d0=dist();z0=e.z;moved=99;if(!pushed){push();pushed=true}}
  };
  d.onpointermove=ev=>{
    const p=P.get(ev.pointerId);if(!p)return;
    const dx=ev.clientX-p[0],dy=ev.clientY-p[1];
    P.set(ev.pointerId,[ev.clientX,ev.clientY]);
    if(P.size===2){e.z=clamp(z0*dist()/d0,1,5);place(im,e);if(sel===i)$('zoom').value=e.z;return}
    moved+=Math.abs(dx)+Math.abs(dy);
    if(moved<4)return;
    if(!pushed){push();pushed=true}
    const f=fit(e,G.cw,G.ch);
    if(f.mx>0.5)e.ox=clamp(e.ox+dx/f.mx,-1,1);
    if(f.my>0.5)e.oy=clamp(e.oy+dy/f.my,-1,1);
    place(im,e);
  };
  d.onpointerup=ev=>{
    const was=P.delete(ev.pointerId);
    if(was&&P.size===0&&moved<4){sel=i;mark()}
  };
  d.onpointercancel=ev=>{P.delete(ev.pointerId)};
  d.onwheel=ev=>{
    ev.preventDefault();
    if(Date.now()-gestT>600)push();
    gestT=Date.now();
    e.z=clamp(e.z*(ev.deltaY<0?1.1:1/1.1),1,5);
    place(im,e);sel=i;mark();
  };
}

function render(){
  const L=Math.min(640,$('stage').clientWidth-4||560);
  G=dims(L);
  const {g,cw,ch,W,H}=G, n=cur.c*cur.r;
  grid.style.cssText=`width:${W}px;height:${H}px;padding:${g}px;gap:${g}px;background:${$('bgc').value};grid-template-columns:repeat(${cur.c},${cw}px);grid-template-rows:repeat(${cur.r},${ch}px)`;
  grid.innerHTML='';
  const rad=$('rad').value/100*Math.min(cw,ch);
  for(let i=0;i<n;i++){
    const d=document.createElement('div'),e=imgs[i];
    d.className='cell';d.style.borderRadius=rad+'px';
    if(e){
      d.classList.add('has');
      const im=document.createElement('img');im.src=e.im.src;im.draggable=false;
      place(im,e);d.appendChild(im);bindEdit(d,im,e,i);
    }else{
      d.textContent=Math.min(cw,ch)>30?'+':'';
      d.onclick=()=>{target=i;fileIn.click()};
    }
    d.ondragover=ev=>{ev.preventDefault();d.classList.add('over')};
    d.ondragleave=()=>d.classList.remove('over');
    d.ondrop=ev=>{ev.preventDefault();d.classList.remove('over');load([...ev.dataTransfer.files],i)};
    grid.appendChild(d);
  }
  if(!(sel!==null&&sel<n&&imgs[sel]))sel=null;
  mark();
}

function load(files,start){
  files=files.filter(f=>f.type.startsWith('image/'));
  const total=cur.c*cur.r,count=Math.min(files.length,total-start);let n=0;
  if(count>0)push();
  files.slice(0,count).forEach((f,k)=>{
    const im=new Image();
    im.onload=()=>{imgs[start+k]={im,z:1,ox:0,oy:0};if(++n===count)render()};
    im.src=URL.createObjectURL(f);
  });
}

fileIn.onchange=()=>{load([...fileIn.files],target);fileIn.value=''};
['gap','rad','bgc','str'].forEach(id=>$(id).oninput=render);
$('lines').oninput=()=>{
  const n=+$('lines').value;$('linesOut').textContent=n;
  LAYOUTS.find(l=>l.lines).c=n;buildOpts();render();
};
$('zoom').oninput=()=>{
  const e=imgs[sel];if(!e)return;
  if(Date.now()-gestT>600)push();
  gestT=Date.now();
  e.z=+$('zoom').value;place(grid.children[sel].querySelector('img'),e);
};
$('ctr').onclick=()=>{const e=imgs[sel];if(!e)return;push();e.z=1;e.ox=e.oy=0;render()};
$('chg').onclick=()=>{if(sel===null)return;target=sel;fileIn.click()};
$('del').onclick=()=>{if(!imgs[sel])return;push();delete imgs[sel];sel=null;render()};
$('clr').onclick=()=>{if(!Object.keys(imgs).length)return;push();imgs={};sel=null;render()};
window.addEventListener('resize',render);

$('dl').onclick=()=>{
  const {g,cw,ch,W,H}=dims(1800),cv=document.createElement('canvas');
  cv.width=Math.round(W);cv.height=Math.round(H);
  const x=cv.getContext('2d');x.fillStyle=$('bgc').value;x.fillRect(0,0,cv.width,cv.height);
  const rad=$('rad').value/100*Math.min(cw,ch);
  for(let i=0;i<cur.c*cur.r;i++){
    const cx=g+(i%cur.c)*(cw+g),cy=g+Math.floor(i/cur.c)*(ch+g);
    x.save();x.beginPath();
    if(x.roundRect)x.roundRect(cx,cy,cw,ch,rad);else x.rect(cx,cy,cw,ch);
    x.clip();
    const e=imgs[i];
    if(e){const f=fit(e,cw,ch);x.drawImage(e.im,cx+f.x,cy+f.y,f.w,f.h)}
    else{x.fillStyle='#e5e3dc';x.fillRect(cx,cy,cw,ch)}
    x.restore();
  }
  cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='collage.png';a.click()});
};

$('undo').onclick=undo;
document.addEventListener('keydown',ev=>{
  if((ev.ctrlKey||ev.metaKey)&&!ev.shiftKey&&ev.key.toLowerCase()==='z'){ev.preventDefault();undo()}
});

// Modo claro / oscuro
function setTheme(t,save=true){
  document.documentElement.dataset.theme=t;
  if(save){try{localStorage.setItem('theme',t)}catch(e){}}
  $('theme').textContent=t==='dark'?'☀ Modo claro':'☾ Modo oscuro';
}
$('theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
setTheme(document.documentElement.dataset.theme==='dark'?'dark':'light',false);

buildOpts();render();
