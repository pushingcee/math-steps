/* =====================================================================
 * RENDERER & EXECUTORS
 * Brackets (abs |..| amber, paren (..) purple) render as a GROUP:
 * [ open ] inner-tiles [ close ]. The group (data-term-id) is the atomic
 * unit for outer moves; bracket tiles + inner number tiles ride along.
 * =================================================================== */
const stage=document.getElementById('stage');
const eqEl=document.getElementById('equation');
let RT=eqEl;        /* active render target: eqEl, or a branch column */
let branchCols=[];  /* column containers when a branched state is shown */
const opBadge=document.getElementById('opBadge');
const arrowLayer=document.getElementById('arrowLayer');
const arrowPath=document.getElementById('arrowPath');
const arrowHead=document.getElementById('arrowHead');
const captionEl=document.getElementById('caption');
const captionBadge=document.getElementById('captionBadge');
const captionText=document.getElementById('captionText');
const dotsEl=document.getElementById('dots');
const btnPrev=document.getElementById('btnPrev');
const btnNext=document.getElementById('btnNext');
const btnReplay=document.getElementById('btnReplay');
const btnBuild=document.getElementById('btnBuild');
const statesInput=document.getElementById('statesInput');
const errorBox=document.getElementById('errorBox');

let lesson=null, stepIndex=-1, animating=false;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

function fracHTML(r){ if(risInt(r)) return String(Math.abs(r.n)); return `<span class="frac"><span>${Math.abs(r.n)}</span><span class="barline"></span><span>${r.d}</span></span>`; }
function lazyStack(num,den,sym){ const a=Math.abs(num.n/num.d); const top=(sym&&a===1)?sym:(a+(sym||'')); return `<span class="frac lz"><span>${top}</span><span class="barline"></span><span>${den.n/den.d}</span></span>`; }
function numBodyHTML(t){ const mag=rabs(t.coef); return t.sym?((req(mag,RONE)?'':fracHTML(mag))+t.sym):fracHTML(mag); }
function innerTileHTML(t,isFirst){
  if(t.kind==='frac'){
    const neg=rnegq(t.num);
    const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+');
    return `<span class="minitile" data-inner-id="${t.id}">`+
      (sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')+
      `<span class="body">${lazyStack(t.num,t.den,t.sym)}</span></span>`;
  }
  if(t.kind==='fracsum'){
    const c=t.coef||RONE; const neg=rnegq(c); const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+'); const m=rabs(c);
    const numHTML=t.numTerms.map((nt,i)=>{ const nn=rnegq(nt.coef); const ss=i===0?(nn?'\u2212':''):(nn?'\u2009\u2212\u2009':'\u2009+\u2009'); return `<span class="fsterm" data-inner-id="${nt.id}">${ss}${(nt.sym&&req(rabs(nt.coef),RONE))?'':fracHTML(rabs(nt.coef))}${nt.sym||''}</span>`; }).join('');
    const coefMul=req(m,RONE)?'':`<span class="coefmul">${fracHTML(m)}</span>`;
    return `<span class="minitile lazyfrac fracsum" data-inner-id="${t.id}" style="box-shadow:none">`+
      (sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')+coefMul+
      `<span class="lf"><span class="fsnum">${numHTML}</span><span class="lfbar"></span><span>${t.den.n/t.den.d}</span></span></span>`;
  }
  if(t.kind==='paren'||t.kind==='abs'){
    const o=(t.kind==='abs')?'|':'('; const c=(t.kind==='abs')?'|':')';
    const neg=rnegq(t.coef); const m=rabs(t.coef);
    const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+');
    let h=`<span class="grp-inline ${t.kind}" data-inner-id="${t.id}">`;
    if(sign) h+=`<span class="sign${neg?' negative':''}">${sign}</span>`;
    if(!req(m,RONE)) h+=`<span class="coefmul">${fracHTML(m)}</span>`;
    h+=`<span class="brackettile" data-bracket="L">${o}</span>`;
    h+=t.inner.map((x,i)=>innerTileHTML(x,i===0)).join('');
    h+=`<span class="brackettile" data-bracket="R">${c}</span></span>`;
    return h;
  }
  if(t.kind==='pow'){
    const neg=rnegq(t.coef); const m=rabs(t.coef);
    const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+');
    if(t.paren){
      let h=`<span class="grp-inline paren" data-inner-id="${t.id}" style="--bracket-color:var(--accent-paren);--bracket-shadow:rgba(130,87,230,.32)">`;
      if(sign) h+=`<span class="sign${neg?' negative':''}">${sign}</span>`;
      if(!req(m,RONE)) h+=`<span class="coefmul">${fracHTML(m)}</span>`;
      h+=`<span class="brackettile" data-bracket="L">(</span>`+t.paren.map((x,i)=>innerTileHTML(x,i===0)).join('')+`<span class="brackettile" data-bracket="R">)</span><sup class="pow-exp">${t.exp}</sup></span>`;
      return h;
    }
    const baseTxt=t.sym!==''?t.sym:fracHTML(rabs(t.base));
    return `<span class="minitile${t.sym?' var':''}" data-inner-id="${t.id}">`+
      (sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')+
      `<span class="body">${req(m,RONE)?'':fracHTML(m)}${baseTxt}<sup class="pow-exp">${t.exp}</sup></span></span>`;
  }
  const neg=rnegq(t.coef);
  const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+');
  return `<span class="minitile${t.sym?' var':''}" data-inner-id="${t.id}">`+
    (sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')+
    `<span class="body">${numBodyHTML({...t,coef:rabs(t.coef)})}</span></span>`;
}
const BRACKETS={ abs:['|','|'], paren:['(',')'] };
function mkGroupTile(t,isFirst){
  const [open,close]=BRACKETS[t.kind];
  const neg=rnegq(t.coef);
  const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+');
  const mag=rabs(t.coef);
  const el=document.createElement('span');
  el.className='tile grp '+t.kind;
  el.dataset.termId=t.id;
  let html=(sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'');
  if(!req(mag,RONE)) html+=`<span class="coefmul">${fracHTML(mag)}</span>`;
  html+=`<span class="brackettile" data-bracket="L">${open}</span>`;
  t.inner.forEach((it,i)=>{ html+=innerTileHTML(it,i===0); });
  html+=`<span class="brackettile" data-bracket="R">${close}</span>`;
  el.innerHTML=html;
  return el;
}
function mkNumTile(t,isFirst){
  const neg=rnegq(t.coef);
  const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+');
  const el=document.createElement('span');
  el.className='tile'+(t.sym?' var':'');
  el.dataset.termId=t.id;
  el.innerHTML=(sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')+`<span class="body">${numBodyHTML({...t,coef:rabs(t.coef)})}</span>`;
  return el;
}
function mkProdTile(t,isFirst){
  const neg=rnegq(t.a); const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+');
  const bneg=rnegq(t.b.coef); const bmag=rabs(t.b.coef);
  let bcore;
  if(t.b.kind==='pow'){
    const coefPre=req(bmag,RONE)?'':fracHTML(bmag);
    const base=t.b.paren
      ? '('+t.b.paren.map((x,i)=>innerFactorHTML(x,i===0)).join('')+')'
      : (t.b.sym!==''?t.b.sym:fracHTML(rabs(t.b.base)));
    bcore=coefPre+base+`<sup class="pow-exp">${t.b.exp}</sup>`;
  } else {
    bcore=t.b.sym?((req(bmag,RONE)?'':fracHTML(bmag))+t.b.sym):fracHTML(bmag);
  }
  const bInner=bneg?('(\u2212'+bcore+')'):bcore;
  const el=document.createElement('span'); el.className='tile prod'; el.dataset.termId=t.id;
  el.innerHTML=(sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')
    +`<span class="minitile" data-inner-id="${t.id}__a"><span class="body">${fracHTML(rabs(t.a))}</span></span>`
    +`<span class="mul">\u00b7</span>`
    +`<span class="minitile${t.b.sym?' var':''}" data-inner-id="${t.id}__b"><span class="body">${bInner}</span></span>`;
  return el;
}
function mkFracTile(t,isFirst){
  // lazy fraction a//b shown as its own green-bordered tile (un-reduced); supports a variable numerator
  const neg=rnegq(t.num); const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+');
  const el=document.createElement('span'); el.className='tile lazyfrac'; el.dataset.termId=t.id;
  const numAbs=Math.abs(t.num.n/t.num.d);
  const numDisp=(t.sym && numAbs===1)?t.sym:(numAbs+(t.sym||''));
  el.innerHTML=(sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')
    +`<span class="lf"><span>${numDisp}</span><span class="lfbar"></span><span>${t.den.n/t.den.d}</span></span>`;
  return el;
}
function mkFracSumTile(t,isFirst){
  // lazy fraction whose numerator is an UNEVALUATED sum, e.g. (7 + 2)//13, over a shared bar
  const c=t.coef||RONE; const neg=rnegq(c); const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+'); const m=rabs(c);
  const el=document.createElement('span'); el.className='tile lazyfrac fracsum'; el.dataset.termId=t.id;
  const numHTML=t.numTerms.map((nt,i)=>{ const nn=rnegq(nt.coef); const s=i===0?(nn?'\u2212':''):(nn?'\u2009\u2212\u2009':'\u2009+\u2009'); return `<span class="fsterm" data-inner-id="${nt.id}">${s}${(nt.sym&&req(rabs(nt.coef),RONE))?'':fracHTML(rabs(nt.coef))}${nt.sym||''}</span>`; }).join('');
  const coefMul=req(m,RONE)?'':`<span class="coefmul">${fracHTML(m)}</span>`;
  el.innerHTML=(sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')+coefMul
    +`<span class="lf"><span class="fsnum">${numHTML}</span><span class="lfbar"></span><span>${t.den.n/t.den.d}</span></span>`;
  return el;
}
function mkMulFactorHTML(f){
  if(f.kind==='num'){ const m=rabs(f.coef); const neg=rnegq(f.coef); const core=f.sym?((req(m,RONE)?'':fracHTML(m))+f.sym):fracHTML(m); return `<span class="minitile${f.sym?' var':''}" data-inner-id="${f.id}">${neg?'(\u2212':''}${core}${neg?')':''}</span>`; }
  if(f.kind==='frac'){ const neg=rnegq(f.num); return `<span class="minitile lazyfrac" style="box-shadow:none" data-inner-id="${f.id}">${neg?'(\u2212':''}<span class="lf"><span>${Math.abs(f.num.n/f.num.d)}</span><span class="lfbar"></span><span>${f.den.n/f.den.d}</span></span>${neg?')':''}</span>`; }
  if(f.kind==='paren'){ const neg=rnegq(f.coef); return `<span class="minitile" data-inner-id="${f.id}">${neg?'(\u2212':'('}${f.inner.map((x,i)=>innerFactorHTML(x,i===0)).join('')}${')'}</span>`; }
  return `<span class="minitile">?</span>`;
}
function innerFactorHTML(t,isFirst){
  if(t.kind==='frac'){ const neg=rnegq(t.num); const s=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+'); return s+lazyStack(t.num,t.den); }
  const neg=rnegq(t.coef); const s=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+'); const m=rabs(t.coef);
  return s+(t.sym?((req(m,RONE)?'':fracHTML(m))+t.sym):fracHTML(m));
}
function mkMulTile(t,isFirst){
  const neg=rnegq(t.coef); const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+'); const m=rabs(t.coef);
  const el=document.createElement('span'); el.className='tile prod'; el.dataset.termId=t.id;
  const coefHTML=req(m,RONE)?'':`<span class="minitile"><span class="body">${fracHTML(m)}</span></span><span class="mul">\u00b7</span>`;
  el.innerHTML=(sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')+coefHTML
    +t.factors.map(mkMulFactorHTML).join('<span class="mul">\u00b7</span>');
  return el;
}
function mkPowTile(t,isFirst){
  const neg=rnegq(t.coef); const sign=isFirst?(neg?'\u2212':''):(neg?'\u2212':'+'); const m=rabs(t.coef);
  const el=document.createElement('span'); el.dataset.termId=t.id;
  if(t.paren){
    // power of a bracket, e.g. (x+4)\u00b2 \u2014 rendered as a parenthesised group with a superscript
    el.className='tile grp paren';
    let h=(sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'');
    if(!req(m,RONE)) h+=`<span class="coefmul">${fracHTML(m)}</span>`;
    h+=`<span class="brackettile" data-bracket="L">(</span>`;
    h+=t.paren.map((x,i)=>innerTileHTML(x,i===0)).join('');
    h+=`<span class="brackettile" data-bracket="R">)</span><sup class="pow-exp">${t.exp}</sup>`;
    el.innerHTML=h; return el;
  }
  const baseTxt=t.sym!==''?t.sym:fracHTML(rabs(t.base));
  const coefPrefix=req(m,RONE)?'':fracHTML(m);
  el.className='tile'+(t.sym?' var':'');
  el.innerHTML=(sign?`<span class="sign${neg?' negative':''}">${sign}</span>`:'')+`<span class="body">${coefPrefix}${baseTxt}<sup class="pow-exp">${t.exp}</sup></span>`;
  return el;
}
function mkSetTile(t,isFirst){
  // terminal solution set: 0 or 25  (renders the roots of a zero-product)
  const el=document.createElement('span'); el.className='tile setans'; el.dataset.termId=t.id;
  el.innerHTML=t.values.map(v=>{ const neg=rnegq(v); return `<span class="rootval">${neg?'\u2212':''}${fracHTML(rabs(v))}</span>`; }).join('<span class="orsep">or</span>');
  return el;
}
function mkTile(t,isFirst){ if(t.kind==='set') return mkSetTile(t,isFirst); if(t.kind==='pow') return mkPowTile(t,isFirst); if(t.kind==='abs'||t.kind==='paren') return mkGroupTile(t,isFirst); if(t.kind==='prod') return mkProdTile(t,isFirst); if(t.kind==='fracsum') return mkFracSumTile(t,isFirst); if(t.kind==='frac') return mkFracTile(t,isFirst); if(t.kind==='mul') return mkMulTile(t,isFirst); return mkNumTile(t,isFirst); }
function mkSide(terms,cls,idtag){
  const div=document.createElement('div'); div.className='side '+cls;
  if(terms.length===0){ const z=document.createElement('span'); z.className='tile zero'; z.dataset.termId='__zero_'+cls+(idtag||''); z.innerHTML='<span class="body">0</span>'; div.appendChild(z); return div; }
  terms.forEach((t,i)=>div.appendChild(mkTile(t,i===0)));
  return div;
}
function renderEquationInto(container, st){
  container.innerHTML='';
  const tag = container===eqEl ? undefined : container.dataset.bi;
  container.appendChild(mkSide(st.left,'left',tag));
  if(st.rel!==null){ const op=document.createElement('span'); op.className='equals'; op.textContent=relStr(st.rel); container.appendChild(op); container.appendChild(mkSide(st.right,'right',tag)); }
}
function renderState(state){
  if(RT!==eqEl){ renderEquationInto(RT, state); return; }   /* rendering inside one branch window */
  eqEl.innerHTML=''; branchCols=[];
  if(state.kind==='branches'){
    const wrap=document.createElement('div'); wrap.className='branchwrap';
    state.branches.forEach((b,i)=>{
      if(i>0){ const dv=document.createElement('div'); dv.className='branchdiv'; wrap.appendChild(dv); }
      const col=document.createElement('div'); col.className='branchcol'; col.dataset.bi=String(i);
      renderEquationInto(col,b); wrap.appendChild(col); branchCols[i]=col;
    });
    eqEl.appendChild(wrap); return;
  }
  renderEquationInto(eqEl, state);
}
function tileEl(id){ return RT.querySelector(`[data-term-id="${id}"]`); }
function clearHighlights(){ RT.querySelectorAll('.highlighted').forEach(t=>t.classList.remove('highlighted','group')); }

async function transitionTo(newState,{hideTermId=null,duration=500}={}){
  const oldRects={}; RT.querySelectorAll('.tile').forEach(t=>oldRects[t.dataset.termId]=t.getBoundingClientRect());
  renderState(newState);
  const anims=[];
  RT.querySelectorAll('.tile').forEach(t=>{
    const id=t.dataset.termId;
    if(hideTermId===id){ t.style.visibility='hidden'; return; }
    const o=oldRects[id];
    if(!o){ anims.push(t.animate([{opacity:0,transform:'scale(.5)'},{opacity:1,transform:'scale(1)'}],{duration,easing:'ease-out'}).finished); return; }
    const n=t.getBoundingClientRect(); const dx=o.left-n.left, dy=o.top-n.top;
    if(dx||dy) anims.push(t.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration,easing:'cubic-bezier(.4,0,.2,1)'}).finished);
  });
  await Promise.all(anims);
}
function showArrow(fromRect,toRect){
  const s=stage.getBoundingClientRect();
  const x1=fromRect.left+fromRect.width/2-s.left, y1=fromRect.top-s.top-8;
  const x2=toRect.left+toRect.width/2-s.left, y2=toRect.top-s.top-8;
  const cx=(x1+x2)/2, cy=Math.min(y1,y2)-70;
  arrowPath.setAttribute('d',`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
  const tx=x2-cx, ty=y2-cy, len=Math.hypot(tx,ty)||1, ux=tx/len, uy=ty/len, sz=12, px=-uy, py=ux;
  arrowHead.setAttribute('points',`${x2},${y2} ${x2-ux*sz+px*sz*.6},${y2-uy*sz+py*sz*.6} ${x2-ux*sz-px*sz*.6},${y2-uy*sz-py*sz*.6}`);
  arrowLayer.classList.add('visible');
}
function hideArrow(){ arrowLayer.classList.remove('visible'); }

async function flyTile(termId,newState,duration=900){
  const source=tileEl(termId); const fromRect=source.getBoundingClientRect();
  const flyer=source.cloneNode(true); flyer.classList.add('flyer'); flyer.classList.remove('highlighted');
  flyer.style.left=fromRect.left+'px'; flyer.style.top=fromRect.top+'px';
  document.body.appendChild(flyer); source.style.visibility='hidden';
  await transitionTo(newState,{hideTermId:termId,duration:400});
  const dest=tileEl(termId); const toRect=dest.getBoundingClientRect();
  showArrow(fromRect,toRect);
  const x1=fromRect.left,y1=fromRect.top,x2=toRect.left,y2=toRect.top,cx=(x1+x2)/2,cy=Math.min(y1,y2)-90;
  const start=performance.now();
  await new Promise(res=>{ function f(now){ let t=Math.min((now-start)/duration,1); const e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2; const mt=1-e;
    flyer.style.left=(mt*mt*x1+2*mt*e*cx+e*e*x2)+'px'; flyer.style.top=(mt*mt*y1+2*mt*e*cy+e*e*y2)+'px'; flyer.style.transform=`rotate(${Math.sin(e*Math.PI)*12}deg)`;
    if(t<1) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); });
  flyer.remove(); dest.style.visibility='visible';
  dest.animate([{transform:'scale(1.15)'},{transform:'scale(1)'}],{duration:250,easing:'ease-out'});
  await sleep(450); hideArrow();
}
async function showOpBadge(text,ms=1100){ opBadge.textContent=text; opBadge.classList.add('visible'); await sleep(ms); opBadge.classList.remove('visible'); }

const executors={
  async highlight(step){ step.termIds.forEach(id=>{ const t=tileEl(id)||RT.querySelector(`[data-inner-id="${id}"]`); if(t){ t.classList.add('highlighted'); if(step.group) t.classList.add('group'); } }); await sleep(900); },
  async move(step){ clearHighlights(); await flyTile(step.termId,step.after); },
  async flipSign(step){
    const b=tileEl(step.termId); if(b) b.classList.add('flipping'); await sleep(350);
    renderState(step.after); const a=tileEl(step.termId);
    if(a){ const s=a.querySelector('.sign'); if(s) s.animate([{transform:'scale(2)'},{transform:'scale(1)'}],{duration:400,easing:'ease-out'}); a.animate([{transform:'rotateY(90deg)'},{transform:'rotateY(0)'}],{duration:350,easing:'ease-out'}); }
    await sleep(400);
  },
  async merge(step){
    clearHighlights(); const surv=tileEl(step.survivorId); const target=surv.getBoundingClientRect(); const anims=[];
    for(const id of step.sourceIds){ if(id===step.survivorId) continue; const t=tileEl(id); const r=t.getBoundingClientRect();
      anims.push(t.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${target.left-r.left}px,${target.top-r.top}px) scale(.5)`,opacity:0}],{duration:550,easing:'ease-in',fill:'forwards'}).finished); }
    await Promise.all(anims); await transitionTo(step.after,{duration:400});
    const f=tileEl(step.survivorId); if(f) f.animate([{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:300,easing:'ease-out'}); await sleep(300);
  },
  async cancel(step){
    clearHighlights(); const anims=[];
    for(const id of step.sourceIds){ const t=tileEl(id); if(!t) continue;
      anims.push(t.animate([{transform:'scale(1)',opacity:1},{transform:'translateY(-10px) scale(1.1)',opacity:1,offset:.4},{transform:'translateY(0) scale(.4)',opacity:0}],{duration:620,easing:'ease-in',fill:'forwards'}).finished); }
    await Promise.all(anims); await transitionTo(step.after,{duration:380}); await sleep(260);
  },
  async evalInside(step){
    // only the like terms being combined collapse — into the point between them — leaving others put
    clearHighlights();
    const container=tileEl(step.termId);
    const find=(id)=> container ? container.querySelector(`[data-inner-id="${id}"]`) : null;
    const srcEls=(step.sourceIds||[]).map(find).filter(Boolean);
    if(srcEls.length>1){
      const rects=srcEls.map(e=>e.getBoundingClientRect());
      const cx=rects.reduce((s,r)=>s+r.left+r.width/2,0)/rects.length;
      const cy=rects.reduce((s,r)=>s+r.top+r.height/2,0)/rects.length;
      const anims=[];
      srcEls.forEach((e,i)=>{ const r=rects[i]; const ex=r.left+r.width/2, ey=r.top+r.height/2;
        anims.push(e.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${cx-ex}px,${cy-ey}px) scale(.5)`,opacity:0}],{duration:520,easing:'ease-in',fill:'forwards'}).finished); });
      await Promise.all(anims);
    } else if(srcEls.length===1){
      srcEls[0].animate([{transform:'scale(1)'},{transform:'scale(.55)',opacity:0}],{duration:340,easing:'ease-in',fill:'forwards'});
      await sleep(340);
    } else {
      // fallback (no ids): old behaviour
      const minis=container?[...container.querySelectorAll('.minitile')]:[];
      if(minis.length>1){ const tg=minis[0].getBoundingClientRect(); const a=[]; for(let i=1;i<minis.length;i++){ const r=minis[i].getBoundingClientRect(); a.push(minis[i].animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${tg.left-r.left}px,${tg.top-r.top}px) scale(.5)`,opacity:0}],{duration:480,fill:'forwards'}).finished); } await Promise.all(a); }
    }
    renderState(step.after);
    const c2=tileEl(step.termId);
    const res = c2 && step.resultId ? c2.querySelector(`[data-inner-id="${step.resultId}"]`) : (c2 && c2.querySelector('.minitile'));
    if(res) res.animate([{transform:'scale(.4)',opacity:.2},{transform:'scale(1.3)',opacity:1},{transform:'scale(1)'}],{duration:460,easing:'ease-out'});
    await sleep(440);
  },
  async applyAbs(step){
    // bars leave; the inner value drops out and becomes a plain number
    clearHighlights();
    const container=tileEl(step.termId);
    if(container){
      const bars=[...container.querySelectorAll('.brackettile')];
      bars.forEach((b,i)=>b.animate([{opacity:1,transform:'scale(1) translateX(0)'},{opacity:0,transform:`scale(.4) translateX(${i===0?-14:14}px)`}],{duration:400,easing:'ease-in',fill:'forwards'}));
      const m=container.querySelector('.minitile');
      if(m) m.animate([{transform:'scale(1)'},{transform:'scale(1.1)'}],{duration:400,easing:'ease-out',fill:'forwards'});
      await sleep(420);
    }
    renderState(step.after);
    const n=tileEl(step.termId);
    if(n){ n.style.borderColor='var(--accent-green)'; n.animate([{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:380,easing:'ease-out'}); setTimeout(()=>{ if(n) n.style.borderColor=''; },680); }
    await sleep(460);
  },
  async distribute(step){
    // brackets fade; inner tiles fly OUT to their distributed positions
    clearHighlights();
    const old={};
    RT.querySelectorAll('.tile[data-term-id]').forEach(t=>old[t.dataset.termId]=t.getBoundingClientRect());
    RT.querySelectorAll('.minitile[data-inner-id]').forEach(m=>old[m.dataset.innerId]=m.getBoundingClientRect());
    const container=tileEl(step.parenId);
    if(container) container.querySelectorAll('.brackettile').forEach((b,i)=>b.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:`scale(.4) translateX(${i===0?-12:12}px)`}],{duration:340,easing:'ease-in',fill:'forwards'}));
    await sleep(300);
    renderState(step.after);
    const anims=[];
    RT.querySelectorAll('.tile[data-term-id]').forEach(t=>{
      const id=t.dataset.termId; const o=old[id]; const n=t.getBoundingClientRect();
      if(o){ const dx=o.left-n.left, dy=o.top-n.top; if(dx||dy) anims.push(t.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:620,easing:'cubic-bezier(.34,1.3,.5,1)'}).finished); }
      else anims.push(t.animate([{opacity:0,transform:'scale(.5)'},{opacity:1,transform:'scale(1)'}],{duration:520,easing:'ease-out'}).finished);
      if(step.distributedIds.includes(id)) t.animate([{transform:'scale(1.3)'},{transform:'scale(1)'}],{duration:560,easing:'ease-out'});
    });
    await Promise.all(anims); await sleep(260);
  },
  async multiply(step){
    clearHighlights();
    const before=tileEl(step.termId); if(before) before.classList.add('flipping');
    await sleep(360); renderState(step.after);
    const after=tileEl(step.termId);
    if(after){ after.style.borderColor='var(--accent-green)'; after.animate([{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:380,easing:'ease-out'}); setTimeout(()=>{ if(after) after.style.borderColor=''; },640); }
    await sleep(420);
  },
  async evalFrac(step){
    clearHighlights();
    const before=tileEl(step.termId);
    if(before){ const lf=before.querySelector('.lf'); if(lf) lf.animate([{transform:'scale(1)'},{transform:'scale(1.15)'},{transform:'scale(.7)',opacity:.4}],{duration:380,easing:'ease-in',fill:'forwards'}); }
    await sleep(400); renderState(step.after);
    const after=tileEl(step.termId);
    if(after){ after.style.borderColor='var(--accent-green)'; after.animate([{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:380,easing:'ease-out'}); setTimeout(()=>{ if(after) after.style.borderColor=''; },640); }
    await sleep(440);
  },
  async rewritePower(step){
    clearHighlights(); const before=tileEl(step.termId); if(before) before.classList.add('flipping');
    await sleep(340); renderState(step.after);
    const after=tileEl(step.termId);
    if(after){ after.style.borderColor='var(--accent-purple)'; after.animate([{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:380,easing:'ease-out'}); setTimeout(()=>{ if(after) after.style.borderColor=''; },640); }
    await sleep(420);
  },
  async evalPower(step){ await this.rewritePower(step); },
  async reorderFactors(step){
    clearHighlights(); const el=tileEl(step.termId);
    if(el) el.animate([{transform:'translateX(0)'},{transform:'translateX(-6px) rotate(-1deg)'},{transform:'translateX(6px) rotate(1deg)'},{transform:'translateX(0)'}],{duration:460,easing:'ease-in-out'});
    await sleep(360); renderState(step.after);
    const a2=tileEl(step.after[step.side==='right'?'right':'left'] ? step.termId : step.termId);
    const t2=tileEl(step.termId); if(t2) t2.animate([{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:300,easing:'ease-out'});
    await sleep(360);
  },
  async zeroProduct(step){
    // product = 0 splits into its roots
    clearHighlights();
    const prod=tileEl(step.productId);
    if(prod){ prod.classList.add('highlight'); }
    await sleep(820); // let the "a product equals zero" caption read
    if(prod){ prod.animate([{opacity:1},{opacity:0}],{duration:320,fill:'forwards'}); }
    await sleep(320); renderState(step.after);
    const roots=[...RT.querySelectorAll('.setans .rootval')];
    roots.forEach((r,i)=>r.animate([{opacity:0,transform:'translateY(8px) scale(.8)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:460,delay:120+i*160,easing:'ease-out'}));
    const setT=RT.querySelector('.setans');
    if(setT){ setT.style.borderColor='var(--accent-green)'; setTimeout(()=>{ if(setT) setT.style.borderColor=''; },1000); }
    await sleep(620+roots.length*160);
  },
  async branchSplit(step){
    // product = 0  forks into one equation per factor (separate columns)
    clearHighlights();
    const prod=tileEl(step.productId);
    if(prod){ prod.animate([{opacity:1},{opacity:0}],{duration:320,fill:'forwards'}); }
    await sleep(360);
    renderState(step.after);
    const cols=[...RT.querySelectorAll('.branchcol')];
    cols.forEach((c,i)=>c.animate([{opacity:0,transform:'translateY(10px) scale(.92)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:480,delay:i*180,easing:'ease-out'}));
    RT.querySelectorAll('.branchdiv').forEach(d=>d.animate([{opacity:0},{opacity:1}],{duration:420,delay:160,fill:'backwards'}));
    await sleep(640+cols.length*180);
  },
  async absSplit(step){
    // |A| = k  forks into the two cases A = k and A = -k (separate columns)
    clearHighlights();
    const ab=tileEl(step.absId);
    if(ab){ ab.animate([{opacity:1},{opacity:0}],{duration:320,fill:'forwards'}); }
    await sleep(360);
    renderState(step.after);
    const cols=[...RT.querySelectorAll('.branchcol')];
    cols.forEach((c,i)=>c.animate([{opacity:0,transform:'translateY(10px) scale(.92)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:480,delay:i*180,easing:'ease-out'}));
    RT.querySelectorAll('.branchdiv').forEach(d=>d.animate([{opacity:0},{opacity:1}],{duration:420,delay:160,fill:'backwards'}));
    await sleep(640+cols.length*180);
  },
  async branchStep(step){
    clearHighlights();
    await transitionTo(step.after,{duration:520});
    const cols=[...RT.querySelectorAll('.branchcol')];
    const col=cols[step.branchIndex];
    if(col){ col.animate([{boxShadow:'0 0 0 2px rgba(34,197,94,0.55)'},{boxShadow:'0 0 0 2px rgba(34,197,94,0)'}],{duration:900,easing:'ease-out'}); }
    await sleep(560);
  },
  async factor(step){
    clearHighlights();
    (step.termIds||[]).forEach(id=>{ const e=tileEl(id); if(e){ e.classList.add('highlight'); } });
    await sleep(820); // let the a^2-b^2 rule caption read
    (step.termIds||[]).forEach(id=>{ const e=tileEl(id); if(e) e.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'}); });
    await sleep(300); renderState(step.after);
    // pulse the new product tile (last term on the side, the mul)
    const tiles=[...RT.querySelectorAll('.tile.prod')]; const prod=tiles[tiles.length-1];
    if(prod){ prod.style.borderColor='var(--accent-green)'; prod.animate([{transform:'scale(.7)',opacity:.3},{transform:'scale(1.12)',opacity:1},{transform:'scale(1)'}],{duration:520,easing:'ease-out'}); setTimeout(()=>{ if(prod) prod.style.borderColor=''; },760); }
    await sleep(560);
  },
  async expand(step){
    clearHighlights(); const before=tileEl(step.termId);
    if(before){ before.classList.add('highlight'); before.animate([{opacity:1},{opacity:0}],{duration:340,fill:'forwards'}); }
    await sleep(420); renderState(step.after);
    RT.querySelectorAll('.tile').forEach((e,i)=>{ e.animate([{transform:'scale(.85)',opacity:.4},{transform:'scale(1)',opacity:1}],{duration:380,delay:i*40,easing:'ease-out'}); });
    await sleep(520);
  },
  async reorderInside(step){
    clearHighlights();
    const before={}; RT.querySelectorAll('[data-inner-id]').forEach(e=>{ before[e.dataset.innerId]=e.getBoundingClientRect(); });
    renderState(step.after);
    RT.querySelectorAll('[data-inner-id]').forEach(e=>{ const b=before[e.dataset.innerId]; if(!b) return; const a=e.getBoundingClientRect(); const dx=b.left-a.left, dy=b.top-a.top; if(dx||dy) e.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:500,easing:'cubic-bezier(.4,0,.2,1)'}); });
    await sleep(580);
  },
  async flatten(step){
    clearHighlights(); const sub=RT.querySelector(`[data-inner-id="${step.subId}"]`);
    if(sub){ sub.querySelectorAll('.brackettile').forEach(b=>b.animate([{opacity:1,transform:'scale(1)'},{opacity:.15,transform:'scale(.6)'}],{duration:420,fill:'forwards'})); }
    await sleep(460);
    await sleep(240); renderState(step.after);
    const parent=tileEl(step.parenId);
    if(parent) parent.animate([{transform:'scale(1.05)'},{transform:'scale(1)'}],{duration:320,easing:'ease-out'});
    await sleep(360);
  },
  async evalProducts(step){
    // each "a\u00b7b" product computes to a single number, in place
    clearHighlights();
    step.prodIds.forEach(id=>{ const t=tileEl(id); if(t) t.classList.add('flipping'); });
    await sleep(350);
    await transitionTo(step.after,{duration:380});
    step.prodIds.forEach(id=>{ const t=tileEl(id); if(t){ t.style.borderColor='var(--accent-green)'; t.animate([{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:340,easing:'ease-out'}); setTimeout(()=>{ if(t) t.style.borderColor=''; },560); } });
    await sleep(400);
  },
  async negateBoth(step){
    clearHighlights(); showOpBadge(step.op); RT.querySelectorAll('.tile').forEach(t=>t.classList.add('flipping')); await sleep(350);
    renderState(step.after); RT.querySelectorAll('.tile .sign').forEach(s=>s.animate([{transform:'scale(2)'},{transform:'scale(1)'}],{duration:400,easing:'ease-out'})); await sleep(500);
  },
  async scaleBoth(step){
    clearHighlights(); showOpBadge(step.op);
    RT.querySelectorAll('.tile').forEach(t=>t.animate([{transform:'scale(1)'},{transform:'scale(.8)'},{transform:'scale(1)'}],{duration:600,easing:'ease-in-out'}));
    await sleep(300); await transitionTo(step.after,{duration:400}); await sleep(400);
  },
  async reorder(step){ clearHighlights(); await transitionTo(step.after,{duration:650}); await sleep(220); },
  async swapSides(step){ clearHighlights(); await transitionTo(step.after,{duration:700}); },
  async expandSquare(step){
    // the squared bracket multiplies itself out: (x+4)\u00b2 \u2192 x\u00b2+8x+16 (or 2(x\u00b2+8x+16))
    clearHighlights();
    const before=tileEl(step.termId);
    if(before){ before.classList.add('flipping'); before.animate([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:380,easing:'ease-in-out'}); }
    await sleep(400);
    renderState(step.after);
    const after=tileEl(step.termId);
    if(after){ // shape B: the expansion stays in a bracket and keeps the id \u2014 pulse in place
      after.animate([{transform:'scale(.7)',opacity:.4},{transform:'scale(1.14)',opacity:1},{transform:'scale(1)'}],{duration:500,easing:'ease-out'});
      after.querySelectorAll('.brackettile').forEach(b=>b.animate([{boxShadow:'0 3px 0 var(--bracket-shadow)'},{boxShadow:'0 0 0 4px var(--accent-paren)'},{boxShadow:'0 3px 0 var(--bracket-shadow)'}],{duration:560,easing:'ease-out'}));
    } else { // shape A: the trinomial terms pop in
      RT.querySelectorAll('.tile').forEach((e,i)=>e.animate([{transform:'scale(.82)',opacity:.35},{transform:'scale(1)',opacity:1}],{duration:380,delay:i*45,easing:'ease-out'}));
    }
    await sleep(500);
  },
  async commonDenom(step){
    // fractions are rescaled to a shared denominator \u2014 they morph in place, then pulse
    clearHighlights();
    await transitionTo(step.after,{duration:520});
    (step.fracIds||[]).forEach(id=>{ const t=tileEl(id)||RT.querySelector(`[data-inner-id="${id}"]`); if(!t) return;
      if(t.dataset.termId){ t.style.borderColor='var(--accent-green)'; setTimeout(()=>{ if(t) t.style.borderColor=''; },760); }
      t.animate([{transform:'scale(1)'},{transform:'scale(1.16)'},{transform:'scale(1)'}],{duration:560,easing:'ease-out'}); });
    await sleep(580);
  },
  async combineFractions(step){
    // same-denominator fractions: mark the shared denominators, then slide both numerators onto one bar
    clearHighlights();
    const find=(id)=> tileEl(id)||RT.querySelector(`[data-inner-id="${id}"]`);
    const srcs=(step.sourceIds||[]).map(find).filter(Boolean);
    srcs.forEach(e=>{ const lf=e.querySelector('.lf'); const den=lf?lf.lastElementChild:null; if(den){ den.style.color='var(--accent-green)'; den.animate([{transform:'scale(1)'},{transform:'scale(1.45)'},{transform:'scale(1.15)'}],{duration:620,easing:'ease-out',fill:'forwards'}); } });
    await sleep(720);
    const surv=find(step.resultId);
    if(surv){ const tg=surv.getBoundingClientRect(); const anims=[];
      srcs.forEach(e=>{ if(e===surv) return; const r=e.getBoundingClientRect();
        anims.push(e.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${tg.left-r.left}px,${tg.top-r.top}px) scale(.62)`,opacity:0}],{duration:520,easing:'ease-in',fill:'forwards'}).finished); });
      await Promise.all(anims);
    }
    renderState(step.after);
    const res=find(step.resultId);
    if(res){ if(res.dataset.termId){ res.style.borderColor='var(--accent-green)'; setTimeout(()=>{ if(res) res.style.borderColor=''; },820); }
      res.animate([{transform:'scale(.55)',opacity:.3},{transform:'scale(1.16)',opacity:1},{transform:'scale(1)'}],{duration:540,easing:'ease-out'});
      const num=res.querySelector('.fsnum'); if(num) num.querySelectorAll('.fsterm').forEach((ft,i)=>ft.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,delay:120+i*90,easing:'ease-out'})); }
    await sleep(620);
  },
  async evalNumerator(step){
    // the unevaluated numerator sum (7 + 2) collapses to a single value (9)
    clearHighlights();
    const find=(id)=> tileEl(id)||RT.querySelector(`[data-inner-id="${id}"]`);
    const fs=find(step.fracsumId);
    if(fs){ const terms=[...fs.querySelectorAll('.fsterm')];
      if(terms.length>1){ const tg=terms[0].getBoundingClientRect(); const anims=[];
        for(let i=1;i<terms.length;i++){ const r=terms[i].getBoundingClientRect();
          anims.push(terms[i].animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${tg.left-r.left}px,0) scale(.5)`,opacity:0}],{duration:460,easing:'ease-in',fill:'forwards'}).finished); }
        await Promise.all(anims);
      }
    }
    renderState(step.after);
    const after=find(step.fracsumId);
    if(after){ if(after.dataset.termId){ after.style.borderColor='var(--accent-green)'; setTimeout(()=>{ if(after) after.style.borderColor=''; },720); }
      const lf=after.querySelector('.lf'); if(lf) lf.animate([{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:380,easing:'ease-out'}); }
    await sleep(460);
  },
  async unwrap(step){
    // only one term left inside \u2014 the brackets fade and it stands on its own
    clearHighlights();
    const c=tileEl(step.parenId);
    if(c){ c.querySelectorAll('.brackettile').forEach((b,i)=>b.animate([{opacity:1,transform:'scale(1) translateX(0)'},{opacity:0,transform:`scale(.4) translateX(${i===0?-12:12}px)`}],{duration:380,easing:'ease-in',fill:'forwards'})); }
    await sleep(400);
    renderState(step.after);
    const n=tileEl(step.parenId);
    if(n) n.animate([{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:340,easing:'ease-out'});
    await sleep(340);
  },
  async reduceFraction(step){
    // a lazy fraction is reduced in place: 10n//4 -> 5n//2
    clearHighlights();
    await transitionTo(step.after,{duration:480});
    const t=tileEl(step.fracId)||RT.querySelector(`[data-inner-id="${step.fracId}"]`);
    if(t){ if(t.dataset.termId){ t.style.borderColor='var(--accent-green)'; setTimeout(()=>{ if(t) t.style.borderColor=''; },740); }
      t.animate([{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:440,easing:'ease-out'}); }
    await sleep(500);
  },
  async celebrate(){ RT.querySelectorAll('.tile').forEach(t=>t.classList.add('celebrate')); await sleep(600); }
};

/* =====================================================================
 * CONTROLLER
 * =================================================================== */
function stateAt(index){ let s=lesson.initial; for(let i=0;i<=index;i++) if(lesson.steps[i].after) s=lesson.steps[i].after; return s; }
function renderDots(){ dotsEl.innerHTML=''; if(!lesson) return; lesson.steps.forEach((_,i)=>{ const d=document.createElement('span'); d.className='dot'+(i<stepIndex?' done':i===stepIndex?' current':''); dotsEl.appendChild(d); }); }
function setCaption(text,badge,done=false){ captionText.textContent=text; captionBadge.textContent=badge; captionEl.classList.toggle('done',done); }
function updateButtons(){ const no=!lesson; btnPrev.disabled=no||animating||stepIndex<0; btnNext.disabled=no||animating||(lesson&&stepIndex>=lesson.steps.length-1); btnReplay.disabled=no||animating; }

async function runStep(step){
  if(step.branchIndex!=null && branchCols[step.branchIndex]){
    const prevRT=RT; RT=branchCols[step.branchIndex];
    const subStep={...step, after: step.after.branches[step.branchIndex]};
    try{ await executors[step.type](subStep); } finally { RT=prevRT; }
    const col=branchCols[step.branchIndex];
    if(col) col.animate([{boxShadow:'0 0 0 2px rgba(34,197,94,.45)'},{boxShadow:'0 0 0 2px rgba(34,197,94,0)'}],{duration:800,easing:'ease-out'});
  } else {
    await executors[step.type](step);
  }
}
async function next(){ if(!lesson||animating||stepIndex>=lesson.steps.length-1) return; animating=true; updateButtons(); stepIndex++;
  const step=lesson.steps[stepIndex]; const last=stepIndex===lesson.steps.length-1;
  setCaption(step.caption,`Step ${stepIndex+1} / ${lesson.steps.length}`,last); renderDots();
  await runStep(step); animating=false; updateButtons(); }
function prev(){ if(!lesson||animating||stepIndex<0) return; RT=eqEl; stepIndex--; hideArrow(); opBadge.classList.remove('visible'); renderState(stateAt(stepIndex));
  if(stepIndex>=0){ const step=lesson.steps[stepIndex]; setCaption(step.caption,`Step ${stepIndex+1} / ${lesson.steps.length}`,stepIndex===lesson.steps.length-1);
    if(step.type==='highlight') step.termIds.forEach(id=>{ const t=tileEl(id)||RT.querySelector(`[data-inner-id="${id}"]`); if(t){ t.classList.add('highlighted'); if(step.group) t.classList.add('group'); } }); }
  else setCaption('Press Next to begin.','Start'); renderDots(); updateButtons(); }
function replay(){ if(!lesson||animating) return; RT=eqEl; stepIndex=-1; hideArrow(); opBadge.classList.remove('visible'); renderState(lesson.initial); setCaption('Press Next to begin.','Start'); renderDots(); updateButtons(); }

function build(){ RT=eqEl; errorBox.classList.remove('visible'); const lines=statesInput.value.split('\n').map(s=>s.trim()).filter(Boolean);
  try{ lesson=plan(lines); replay(); }
  catch(e){ lesson=null; RT.innerHTML=''; dotsEl.innerHTML=''; setCaption('Fix the states above, then press Build lesson.','Error'); errorBox.innerHTML='<strong>Can\u2019t build this lesson:</strong> '+e.message; errorBox.classList.add('visible'); updateButtons(); } }

const examples={
  plain:'55 + 45\n100',
  abs:'|3 - 4| + 5\n|-1| + 5\n1 + 5\n6',
  paren:'2(x + 3) = 10\n2x + 6 = 10\n2x = 10 - 6\n2x = 4\nx = 2',
  ineqPos:'2x + 1 <= 7\n2x <= 7 - 1\n2x <= 6\nx <= 3',
  ineqNeg:'-2x < 6\nx > -3',
  nested:'2(2 + (x + 3)) = 10\n2(2 + x + 3) = 10\n2(x + 5) = 10\n2x + 10 = 10\n2x = 0\nx = 0',
  quad:'49 - x^2\n7^2 - x^2\n(7 - x) * (7 + x)\n(7 + x) * (7 - x)',
  squareIneq:'(x+4)^2 - (14x+3)/2 - (2-x)^2 > 2x\n2(x+4)^2 - (14x+3) - 2(2-x)^2 > 4x\n2(x^2+8x+16) - (14x+3) - 2(x^2-4x+4) > 4x\n2x^2+16x+32 - 14x-3 - 2x^2+8x-8 > 4x\n10x+21 > 4x\n6x > -21\nx > -7/2',
  lazy:'2025 - 225*(-1//5)\n2025 - (-225//5)\n2025 - (-45)\n2025 + 45\n2070',
  addFrac:'(7//13 + 2//13) + (1//13 + 8//13)\n9//13 + 9//13\n18//13',
  varFrac:'3n//4 + n//2 + n//4 + n = 1200\n3n//4 + 2n//4 + n//4 + 4n//4 = 1200\n(3n + 2n + n + 4n)//4 = 1200\n10n//4 = 1200\n5n//2 = 1200\nn = 480',
  zeroProd:'x^2 = 25x\nx^2 - 25x = 0\nx*(x - 25) = 0\nx = 0 | x - 25 = 0\nx = 0 | x = 25',
  absEq:'|x + 1| = 4\nx + 1 = 4 | x + 1 = -4\nx = 3 | x + 1 = -4\nx = 3 | x = -5',
  autofill:'2x + 3x + 3 - 4 = 6\n5x = 7',
  likeTerms:'2x + 3x - 4 = 6\n5x - 4 = 6\n5x = 6 + 4\n5x = 10\nx = 2',
  bad:'-2x < 6\nx < -3'
};
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ statesInput.value=examples[c.dataset.example]; build(); }));
btnBuild.addEventListener('click',build);
btnNext.addEventListener('click',next);
btnPrev.addEventListener('click',prev);
btnReplay.addEventListener('click',replay);
document.addEventListener('keydown',e=>{ if(e.target===statesInput) return; if(e.key==='ArrowRight') next(); if(e.key==='ArrowLeft') prev(); });
build();
