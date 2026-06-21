/* =====================================================================
 * RATIONALS
 * =================================================================== */
function gcd(a, b){ a=Math.abs(a); b=Math.abs(b); while(b){ [a,b]=[b,a%b]; } return a||1; }
function R(n, d=1){ if(d===0) throw new Error('Division by zero in a coefficient.'); if(d<0){n=-n;d=-d;} const g=gcd(n,d); return {n:n/g,d:d/g}; }
const radd=(a,b)=>R(a.n*b.d+b.n*a.d, a.d*b.d);
const rmul=(a,b)=>R(a.n*b.n, a.d*b.d);
const rdiv=(a,b)=>R(a.n*b.d, a.d*b.n);
const rneg=(a)=>R(-a.n,a.d);
const req=(a,b)=>a.n===b.n&&a.d===b.d;
const rzero=(a)=>a.n===0;
const rnegq=(a)=>a.n<0;
const risInt=(a)=>a.d===1;
const rabs=(a)=>R(Math.abs(a.n),a.d);
const rstr=(a)=>a.d===1?String(a.n):`${a.n}/${a.d}`;
const RONE=R(1), RNEGONE=R(-1), RZERO=R(0);
function decimalToRational(s){ if(!s.includes('.')) return R(parseInt(s,10)); const [i,f]=s.split('.'); const d=Math.pow(10,f.length); return R(parseInt((i||'0')+f,10), d); }

/* =====================================================================
 * RELATIONS
 * =================================================================== */
const flipRel=(r)=>({'<':'>','>':'<','<=':'>=','>=':'<=','=':'='}[r]);
const relStr=(r)=>({'<':'<','>':'>','<=':'\u2264','>=':'\u2265','=':'='}[r]);

/* =====================================================================
 * PARSER  (supports 2x, -x, 1/2, 0.5, 3/4x, |3-4|, 2|x|, relations)
 * State: { left:Term[], rel:'='|'<'|'>'|'<='|'>='|null, right:Term[]|null }
 * Term:  { kind:'num', coef, sym } | { kind:'abs', coef, inner:Term[] }
 * =================================================================== */
function parseStatement(str, lineNo){
  let s = str.replace(/[\u2212\u2013\u2014]/g,'-').replace(/\u2264/g,'<=').replace(/\u2265/g,'>=').trim();
  { const bparts=s.split(/\s+\|\s+/);
    if(bparts.length>=2 && bparts.every(p=>/[<>=]/.test(p) && !p.includes('|')))
      return { kind:'branches', branches: bparts.map(p=>parseStatement(p, lineNo)) }; }
  if(/\bor\b/i.test(s)){
    const parts=s.split(/\s+or\s+/i); let v=null; const vals=[]; let ok=true;
    for(const p of parts){ const m=/^([a-zA-Z])\s*=\s*(.+)$/.exec(p.trim()); if(!m){ ok=false; break; }
      if(v===null) v=m[1]; else if(v!==m[1]){ ok=false; break; }
      let vs=m[2].replace(/\s/g,''), sg=1; while(vs[0]==='+'||vs[0]==='-'){ if(vs[0]==='-') sg*=-1; vs=vs.slice(1); }
      const val=parseNumber(vs); if(val===null){ ok=false; break; } vals.push(sg<0?rneg(val):val); }
    if(ok && v!==null && vals.length>=2) return { left:[{kind:'num',coef:RONE,sym:v}], rel:'=', right:[{kind:'set', values:vals}] };
  }
  let rel=null, idx=-1, opLen=0;
  for(let i=0;i<s.length;i++){
    const two=s.slice(i,i+2);
    if(two==='<='||two==='>='){ rel=two; idx=i; opLen=2; break; }
    const one=s[i];
    if(one==='='||one==='<'||one==='>'){ rel=one; idx=i; opLen=1; break; }
  }
  if(rel===null) return { left: parseSide(s, lineNo), rel:null, right:null };
  const L=s.slice(0,idx), Rr=s.slice(idx+opLen);
  return { left: parseSide(L, lineNo), rel, right: parseSide(Rr, lineNo) };
}

function parseNumber(s){
  if(s==='') return RONE;
  if(s.includes('/')){ const [a,b]=s.split('/'); if(a===''||b===''||b===undefined) return null; return rdiv(decimalToRational(a), decimalToRational(b)); }
  return decimalToRational(s);
}

function splitTerms(src, lineNo){
  const terms=[]; let cur=''; let inBars=false; let depth=0;
  for(let i=0;i<src.length;i++){
    const c=src[i];
    if(c==='|'){ inBars=!inBars; cur+=c; }
    else if(c==='('){ depth++; cur+=c; }
    else if(c===')'){ depth--; if(depth<0) throw new Error(`Line ${lineNo}: unmatched ) parenthesis.`); cur+=c; }
    else if((c==='+'||c==='-') && !inBars && depth===0 && cur!==''){ terms.push(cur); cur=c; }
    else cur+=c;
  }
  if(inBars) throw new Error(`Line ${lineNo}: unmatched | in an absolute value.`);
  if(depth!==0) throw new Error(`Line ${lineNo}: unmatched ( parenthesis.`);
  if(cur!=='') terms.push(cur);
  return terms;
}

const NUMRE=/^(?:\d+(?:\.\d+)?|\.\d+)(?:\/(?:\d+(?:\.\d+)?|\.\d+))?$/;
function splitTopLevel(str, op){
  const parts=[]; let cur=''; let depth=0; let inBars=false;
  for(let i=0;i<str.length;i++){
    const c=str[i];
    if(c==='|'){ inBars=!inBars; cur+=c; continue; }
    if(c==='('){ depth++; cur+=c; continue; }
    if(c===')'){ depth--; cur+=c; continue; }
    if(depth===0 && !inBars){
      if(op==='*' && c==='*'){ parts.push(cur); cur=''; continue; }
      if(op==='//' && c==='/' && str[i+1]==='/'){ parts.push(cur); cur=''; i++; continue; }
    }
    cur+=c;
  }
  parts.push(cur);
  return parts;
}
function signedNumber(s, lineNo){
  let sg=1, r=s;
  while(r[0]==='+'||r[0]==='-'){ if(r[0]==='-') sg*=-1; r=r.slice(1); }
  if(!NUMRE.test(r)) throw new Error(`Line ${lineNo}: "${s}" is not a number in a // fraction.`);
  let v=parseNumber(r); if(v===null) throw new Error(`Line ${lineNo}: bad number "${s}".`);
  return sg<0?rneg(v):v;
}
function parseFactor(str, lineNo){
  const fp=splitTopLevel(str,'//');
  if(fp.length>1){
    if(fp.length!==2) throw new Error(`Line ${lineNo}: only a simple a//b lazy fraction is supported.`);
    const num=signedNumber(fp[0],lineNo), den=signedNumber(fp[1],lineNo);
    if(rzero(den)) throw new Error(`Line ${lineNo}: division by zero in "${str}".`);
    return {kind:'frac', num, den};
  }
  return parseTerm(str, lineNo);
}
function parseTerm(tok, lineNo){
  let sign=1, rest=tok;
  while(rest[0]==='+'||rest[0]==='-'){ if(rest[0]==='-') sign*=-1; rest=rest.slice(1); }
  const numRe=NUMRE;
  // product of factors (lazy *)
  const mulParts=splitTopLevel(rest,'*');
  if(mulParts.length>1){
    const factors=mulParts.map(p=>parseFactor(p, lineNo));
    return { kind:'mul', coef:R(sign), factors };
  }
  // lazy fraction (//)
  const fracParts=splitTopLevel(rest,'//');
  if(fracParts.length>1){
    if(fracParts.length!==2) throw new Error(`Line ${lineNo}: only a simple a//b lazy fraction is supported.`);
    const den=signedNumber(fracParts[1],lineNo);
    if(rzero(den)) throw new Error(`Line ${lineNo}: division by zero in "${tok}".`);
    let numStr=fracParts[0].trim(), nsg=1;
    while(numStr[0]==='+'||numStr[0]==='-'){ if(numStr[0]==='-') nsg*=-1; numStr=numStr.slice(1).trim(); }
    if(numStr[0]==='(' && numStr[numStr.length-1]===')'){
      let depth=0, wraps=true;
      for(let k=0;k<numStr.length;k++){ if(numStr[k]==='(')depth++; else if(numStr[k]===')'){depth--; if(depth===0 && k<numStr.length-1){wraps=false;break;}} }
      if(wraps){ const numTerms=parseSide(numStr.slice(1,-1), lineNo); return { kind:'fracsum', coef:R(sign*nsg), numTerms, den }; }
    }
    const numTerm=parseTerm((nsg<0?'-':'')+numStr, lineNo);
    if(numTerm.kind==='num'){ let num=numTerm.coef; if(sign<0) num=rneg(num); return { kind:'frac', num, den, sym:numTerm.sym }; }
    throw new Error(`Line ${lineNo}: the numerator "${fracParts[0]}" in a // fraction must be a number or a variable term.`);
  }
  // power: base ^ integer  (x^2, 7^2, 3x^2, -x^2) — no parenthesised base
  if(rest.indexOf('^')>=0 && !rest.includes('(') && !rest.includes('|')){
    const ci=rest.indexOf('^');
    const baseStr=rest.slice(0,ci), expStr=rest.slice(ci+1);
    if(!/^\d+$/.test(expStr)) throw new Error(`Line ${lineNo}: the exponent in "${tok}" must be a positive whole number.`);
    const exp=parseInt(expStr,10);
    const bm=/^((?:\d+(?:\.\d+)?)?)([a-zA-Z]?)$/.exec(baseStr);
    if(!bm || (bm[1]===''&&bm[2]==='')) throw new Error(`Line ${lineNo}: can't read the base "${baseStr}" in "${tok}".`);
    let coef=RONE, base=RONE, sym='';
    if(bm[2]){ sym=bm[2]; coef=bm[1]===''?RONE:parseNumber(bm[1]); }
    else { base=parseNumber(bm[1]); }
    if(coef===null||base===null) throw new Error(`Line ${lineNo}: bad number in "${tok}".`);
    if(sign<0) coef=rneg(coef);
    return { kind:'pow', coef, sym, base, exp };
  }
  if(rest.includes('(')){
    const first=rest.indexOf('(');
    // find the matching close paren for the first open (supports nesting)
    let depth=0, last=-1;
    for(let i=first;i<rest.length;i++){ if(rest[i]==='(') depth++; else if(rest[i]===')'){ depth--; if(depth===0){ last=i; break; } } }
    if(last<0) throw new Error(`Line ${lineNo}: unbalanced parentheses in "${tok}".`);
    const coefStr=rest.slice(0,first), innerStr=rest.slice(first+1,last); let after=rest.slice(last+1);
    if(coefStr!=='' && !numRe.test(coefStr)) throw new Error(`Line ${lineNo}: bad coefficient "${coefStr}" before the parentheses.`);
    let coef = coefStr===''?RONE:parseNumber(coefStr);
    if(coef===null) throw new Error(`Line ${lineNo}: bad coefficient "${coefStr}".`);
    if(sign<0) coef=rneg(coef);
    const inner=parseSide(innerStr, lineNo);
    if(inner.some(t=>t.kind==='abs')) throw new Error(`Line ${lineNo}: brackets can't contain | | absolute values.`);
    // (..)^n  -> squared/powered bracket
    let powExp=null;
    const pm=/^\^(\d+)$/.exec(after);
    if(pm){ powExp=parseInt(pm[1],10); after=''; }
    // (..)/n  -> bracket over a number (coefficient 1/n)
    const dm=/^\/(\d+(?:\.\d+)?)$/.exec(after);
    if(dm){ const d=parseNumber(dm[1]); if(d===null||rzero(d)) throw new Error(`Line ${lineNo}: bad divisor in "${tok}".`); coef=rdiv(coef,d); after=''; }
    if(after!=='') throw new Error(`Line ${lineNo}: can't read "${after}" after the parentheses (use * between brackets, e.g. (a)*(b)).`);
    if(powExp!==null) return { kind:'pow', coef, paren:inner, exp:powExp, sym:'' };
    return { kind:'paren', coef, inner };
  }
  if(rest.includes('|')){
    const bars=(rest.match(/\|/g)||[]).length;
    if(bars!==2) throw new Error(`Line ${lineNo}: only simple |...| absolute values are supported (no nesting).`);
    const first=rest.indexOf('|'), last=rest.lastIndexOf('|');
    const coefStr=rest.slice(0,first), innerStr=rest.slice(first+1,last), after=rest.slice(last+1);
    if(after!=='') throw new Error(`Line ${lineNo}: can't read "${after}" after the bars.`);
    if(coefStr!=='' && !numRe.test(coefStr)) throw new Error(`Line ${lineNo}: bad number "${coefStr}" before the bars.`);
    let coef = coefStr===''?RONE:parseNumber(coefStr);
    if(coef===null) throw new Error(`Line ${lineNo}: bad number "${coefStr}" before the bars.`);
    if(sign<0) coef=rneg(coef);
    const inner=parseSide(innerStr, lineNo);
    if(inner.some(t=>t.kind!=='num')) throw new Error(`Line ${lineNo}: absolute-value bars can only contain numbers and variables.`);
    return { kind:'abs', coef, inner };
  }
  // a term divided by a number: n/2, 3n/4, 2x/5, 3/4 -> fractional coefficient (eager)
  if(rest.indexOf('/')>=0){
    const si=rest.indexOf('/');
    const leftStr=rest.slice(0,si), rightStr=rest.slice(si+1);
    if(leftStr!=='' && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(rightStr)){
      const denom=parseNumber(rightStr);
      if(denom===null) throw new Error(`Line ${lineNo}: bad number in "${tok}".`);
      if(rzero(denom)) throw new Error(`Line ${lineNo}: division by zero in "${tok}".`);
      const left=parseTerm(leftStr, lineNo);
      if(left.coef!==undefined){ let coef=rdiv(left.coef, denom); if(sign<0) coef=rneg(coef); return {...left, coef}; }
    }
  }
  const m=/^((?:\d+(?:\.\d+)?|\.\d+)(?:\/(?:\d+(?:\.\d+)?|\.\d+))?)?([a-zA-Z]?)$/.exec(rest);
  if(!m) throw new Error(`Line ${lineNo}: can't read "${tok}".`);
  const num=m[1], sym=m[2];
  if((num===undefined||num==='') && !sym) throw new Error(`Line ${lineNo}: can't read "${tok}".`);
  let coef=parseNumber(num===undefined?'':num);
  if(coef===null) throw new Error(`Line ${lineNo}: bad number in "${tok}".`);
  if(sign<0) coef=rneg(coef);
  return { kind:'num', coef, sym: sym||'' };
}

function parseSide(s, lineNo){
  const src=s.replace(/\s+/g,'');
  if(src==='') throw new Error(`Line ${lineNo}: one side is empty.`);
  if(src==='0') return [];
  return splitTerms(src, lineNo).map(t=>parseTerm(t, lineNo));
}

/* =====================================================================
 * TERM EQUALITY / IDS / SIGNATURES
 * =================================================================== */
let idCounter=0;
const newId=()=>'t'+(idCounter++);
function assignIds(terms){ return terms.map(t=>{ const c={...t, id:newId()}; if(t.inner) c.inner=assignIds(t.inner); if(t.factors) c.factors=assignIds(t.factors); if(t.paren) c.paren=assignIds(t.paren); if(t.numTerms) c.numTerms=assignIds(t.numTerms); return c; }); }
function assignState(r){ return r.kind==='branches' ? {kind:'branches', branches:r.branches.map(assignState)} : {left:assignIds(r.left), rel:r.rel, right:r.rel===null?null:assignIds(r.right)}; }

function termEq(a,b){
  if(a.kind!==b.kind) return false;
  if(a.kind==='num') return a.sym===b.sym && req(a.coef,b.coef);
  if(a.kind==='frac') return req(a.num,b.num) && req(a.den,b.den) && (a.sym||'')===(b.sym||'');
  if(a.kind==='mul') return req(a.coef,b.coef) && a.factors.length===b.factors.length && a.factors.every((f,i)=>termEq(f,b.factors[i]));
  if(a.kind==='pow'){ if(a.paren||b.paren){ return !!a.paren===!!b.paren && req(a.coef,b.coef) && a.exp===b.exp && sameMultiset(a.paren||[],b.paren||[]); } return req(a.coef,b.coef) && a.sym===b.sym && a.exp===b.exp && (a.sym!==''||req(a.base,b.base)); }
  if(a.kind==='fracsum') return req(a.coef||RONE,b.coef||RONE) && req(a.den,b.den) && a.numTerms.length===b.numTerms.length && a.numTerms.every((t,i)=>termEq(t,b.numTerms[i]));
  if(a.kind==='set'){ const sa=a.values.map(rstr).slice().sort(), sb=b.values.map(rstr).slice().sort(); return sa.length===sb.length&&sa.every((x,i)=>x===sb[i]); }
  return req(a.coef,b.coef) && sameMultiset(a.inner,b.inner);
}

function sameMultiset(a,b){
  if(a.length!==b.length) return false;
  const used=new Array(b.length).fill(false);
  for(const t of a){ let f=-1; for(let i=0;i<b.length;i++){ if(!used[i]&&termEq(t,b[i])){f=i;break;} } if(f<0) return false; used[f]=true; }
  return true;
}
function sameSequence(a,b){ return a.length===b.length && a.every((t,i)=>termEq(t,b[i])); }
function termSig(t){ if(t.kind==='set') return 'set:'+t.values.map(rstr).slice().sort().join(','); if(t.kind==='num') return `n${rstr(t.coef)}:${t.sym}`; if(t.kind==='frac') return `f${rstr(t.num)}/${rstr(t.den)}${t.sym||''}`; if(t.kind==='fracsum') return `fs${rstr(t.coef||RONE)}:(${t.numTerms.map(termSig).join('+')})/${rstr(t.den)}`; if(t.kind==='mul') return `m${rstr(t.coef)}:(${t.factors.map(termSig).join('*')})`; if(t.kind==='pow') return t.paren ? `pp${rstr(t.coef)}:(${t.paren.map(termSig).join('+')})^${t.exp}` : `p${rstr(t.coef)}:${t.sym}^${t.exp}:${t.sym===''?rstr(t.base):''}`; return `${t.kind[0]}${rstr(t.coef)}:${innerSig(t.inner)}`; }
function innerSig(terms){ return '['+terms.map(termSig).sort().join(',')+']'; }
function groupKey(t){ if(t.kind==='set') return 'set:'+termSig(t); if(t.kind==='num') return 'n:'+t.sym; if(t.kind==='pow') return t.paren?('PP:'+t.exp+':'+t.paren.map(termSig).join('+')):(t.sym?('p:'+t.sym+'^'+t.exp):('X:'+termSig(t))); if(t.kind==='fracsum') return 'X:'+termSig(t); if(t.kind==='frac'||t.kind==='mul') return 'X:'+termSig(t); return t.kind[0]+':'+innerSig(t.inner); }

const negList=(list)=>list.map(t=> t.kind==='frac' ? {...t, num:rneg(t.num)} : {...t, coef:rneg(t.coef||RONE)});
const negTerm=(t)=> t.kind==='frac' ? {...t, num:rneg(t.num)} : {...t, coef:rneg(t.coef||RONE)};
const scaleList=(list,k)=>list.map(t=> t.kind==='frac' ? {...t, num:rmul(t.num,k)} : {...t, coef:rmul(t.coef,k)});

function matchTerms(target, pool){
  const used=new Set(); const out=[];
  for(const t of target){ let f=null; for(const p of pool){ if(used.has(p.id))continue; if(termEq(p,t)){f=p;break;} } if(!f) return null; used.add(f.id); out.push(f); }
  return out;
}

/* =====================================================================
 * NORMAL FORM (evaluates constant-inner abs; opaque for variable abs)
 * =================================================================== */
function valueOf(t){
  if(t.kind==='num') return t.coef;
  if(t.kind==='frac') return rdiv(t.num, t.den);
  if(t.kind==='paren') return rmul(t.coef, t.inner.reduce((a,x)=>radd(a,valueOf(x)),RZERO));
  if(t.kind==='abs') return rmul(t.coef, rabs(t.inner.reduce((a,x)=>radd(a,valueOf(x)),RZERO)));
  if(t.kind==='mul') return t.factors.reduce((a,f)=>rmul(a,valueOf(f)), t.coef);
  return RZERO;
}
function ipow(b,e){ let r=RONE; for(let i=0;i<e;i++) r=rmul(r,b); return r; }
function monoFromKey(k){ const m={}; if(k===''||k==='') return m; if(k.startsWith('ABS')) return null; for(const part of k.split('*')){ const ix=part.lastIndexOf('^'); const v=part.slice(0,ix), e=part.slice(ix+1); m[v]=(m[v]||0)+parseInt(e,10); } return m; }
function keyFromMono(m){ const vs=Object.keys(m).filter(v=>m[v]!==0).sort(); if(vs.length===0) return ''; return vs.map(v=>v+'^'+m[v]).join('*'); }
function polyAdd(p,q){ const r={...p}; for(const k in q) r[k]=radd(r[k]||RZERO,q[k]); return r; }
function polyScale(p,c){ const r={}; for(const k in p) r[k]=rmul(p[k],c); return r; }
function polyMul(p,q){ const r={}; for(const k1 in p) for(const k2 in q){ const m1=monoFromKey(k1), m2=monoFromKey(k2); let k; if(m1===null||m2===null){ k='ABS_MIX'; } else { const m={...m1}; for(const v in m2) m[v]=(m[v]||0)+m2[v]; k=keyFromMono(m); } r[k]=radd(r[k]||RZERO, rmul(p[k1],q[k2])); } return r; }
function polyClean(p){ const r={}; for(const k in p) if(!rzero(p[k])) r[k]=p[k]; return r; }
function polyPow(p,e){ let r={'':RONE}; for(let i=0;i<e;i++) r=polyMul(r,p); return r; }
function polyToTerms(poly){
  const pc=polyClean(poly); const keys=Object.keys(pc);
  const deg=(k)=> k===''?0:k.split('*').reduce((s,p)=>s+parseInt(p.split('^')[1],10),0);
  keys.sort((a,b)=> deg(b)-deg(a) || (a<b?-1:1));
  return keys.map(k=>{
    if(k==='') return {kind:'num', coef:pc[k], sym:''};
    const parts=k.split('*');
    if(parts.length===1){ const ix=parts[0].lastIndexOf('^'); const v=parts[0].slice(0,ix), e=parseInt(parts[0].slice(ix+1),10); return e===1?{kind:'num',coef:pc[k],sym:v}:{kind:'pow',coef:pc[k],sym:v,exp:e,base:RONE}; }
    return {kind:'num', coef:pc[k], sym:k};
  });
}
function termPoly(t){
  if(t.kind==='num'){ const k=t.sym===''?'':keyFromMono({[t.sym]:1}); return {[k]:t.coef}; }
  if(t.kind==='pow'){ if(t.paren) return polyScale(polyPow(normalForm(t.paren), t.exp), t.coef); return t.sym ? {[keyFromMono({[t.sym]:t.exp})]: t.coef} : {'': rmul(t.coef, ipow(t.base,t.exp))}; }
  if(t.kind==='frac'){ const v=rdiv(t.num,t.den); return t.sym ? {[keyFromMono({[t.sym]:1})]: v} : {'': v}; }
  if(t.kind==='fracsum'){ return polyScale(normalForm(t.numTerms), rdiv(t.coef||RONE, t.den)); }
  if(t.kind==='paren'){ return polyScale(normalForm(t.inner), t.coef); }
  if(t.kind==='mul'){ let acc={'':RONE}; for(const f of t.factors) acc=polyMul(acc, termPoly(f)); return polyScale(acc, t.coef); }
  if(t.kind==='abs'){ const nf=polyClean(normalForm(t.inner)); const ks=Object.keys(nf);
    if(ks.length===0) return {};
    if(ks.length===1 && ks[0]==='') return {'': rmul(t.coef, rabs(nf['']))};
    return {['ABS'+innerSig(t.inner)]: t.coef}; }
  return {};
}
function normalForm(terms){ let p={}; for(const t of terms) p=polyAdd(p, termPoly(t)); return polyClean(p); }

/* =====================================================================
 * FORMATTING
 * =================================================================== */
function signOf(t){ return t.kind==='frac' ? rnegq(t.num) : rnegq(t.coef); }
function innerText(terms){
  return terms.map((t,i)=>{ const neg=signOf(t); const sign=i===0?(neg?'\u2212':''):(neg?' \u2212 ':' + '); return sign+bodyText(t); }).join('');
}
function bodyText(t){
  if(t.kind==='num'){ const m=rabs(t.coef); return t.sym?((req(m,RONE)?'':rstr(m))+t.sym):rstr(m); }
  if(t.kind==='frac'){ return rstr(rabs(t.num))+(t.sym||'')+'//'+rstr(t.den); }
  if(t.kind==='abs'){ const m=rabs(t.coef); return (req(m,RONE)?'':rstr(m))+'|'+innerText(t.inner)+'|'; }
  if(t.kind==='paren'){ const m=rabs(t.coef); return (req(m,RONE)?'':rstr(m))+'('+innerText(t.inner)+')'; }
  if(t.kind==='mul'){ const m=rabs(t.coef); const fs=t.factors.map(f=> signOf(f)?('('+'\u2212'+bodyText(f)+')'):bodyText(f)).join('\u00b7'); return (req(m,RONE)?'':rstr(m)+'\u00b7')+fs; }
  if(t.kind==='pow'){ const m=rabs(t.coef); const baseTxt=t.sym!==''?t.sym:rstr(t.base); return (req(m,RONE)?'':rstr(m))+baseTxt+'^'+t.exp; }
  return rstr(rabs(t.coef));
}
function fmtTerm(t,{withSign=true}={}){
  const body=bodyText(t);
  if(!withSign) return body;
  return (signOf(t)?'\u2212':'+')+body;
}
function prodText(prods){
  return prods.map((p,i)=>{
    const neg=rnegq(p.a); const sign=i===0?(neg?'\u2212':''):(neg?' \u2212 ':' + ');
    const aStr=rstr(rabs(p.a));
    const bneg=rnegq(p.b.coef); const bmag=rabs(p.b.coef);
    let bStr = p.b.sym ? ((req(bmag,RONE)?'':rstr(bmag))+p.b.sym) : rstr(bmag);
    if(bneg) bStr='(\u2212'+bStr+')';
    return sign+aStr+'\u00b7'+bStr;
  }).join('');
}

/* =====================================================================
 * COMBINE (partial supported via subset partition)
 * =================================================================== */
function partitionIntoSums(pool, targets){
  const n=pool.length;
  if(n>14) return null;
  const full=(1<<n)-1;
  const result=new Array(targets.length);
  const popcount=(m)=>{ let c=0; while(m){ m&=m-1; c++; } return c; };
  function go(ti, used){
    if(ti===targets.length) return used===full;
    for(let m=1;m<=full;m++){
      if(m&used) continue;
      if(popcount(m)<2) continue;
      let sum=RZERO; for(let i=0;i<n;i++) if(m&(1<<i)) sum=radd(sum,pool[i].coef);
      if(!req(sum,targets[ti].coef)) continue;
      result[ti]=[]; for(let i=0;i<n;i++) if(m&(1<<i)) result[ti].push(pool[i]);
      if(go(ti+1, used|m)) return true;
    }
    return false;
  }
  return go(0,0)?result:null;
}
function combineGroups(before, after){
  if(before.concat(after).some(t=>t.coef===undefined)) return null;
  if(sameMultiset(before, after)) return [];
  const sumByKey=(list)=>{ const m={}; for(const t of list) m[groupKey(t)]=radd(m[groupKey(t)]||RZERO,t.coef); return m; };
  const sb=sumByKey(before), sa=sumByKey(after);
  const keys=new Set([...Object.keys(sb),...Object.keys(sa)]);
  for(const k of keys) if(!req(sb[k]||RZERO, sa[k]||RZERO)) return null;
  const groups=[];
  for(const k of keys){
    const bT=before.filter(t=>groupKey(t)===k), aT=after.filter(t=>groupKey(t)===k);
    if(sameMultiset(bT,aT)) continue;
    const bRem=[...bT], aRem=[];
    outer: for(const t of aT){ for(let i=0;i<bRem.length;i++){ if(termEq(bRem[i],t)){ bRem.splice(i,1); continue outer; } } aRem.push(t); }
    if(aRem.length===0){ if(bRem.length<2) return null; groups.push({sources:bRem, cancel:true}); continue; }
    if(bRem.length<2) return null;
    const assign=partitionIntoSums(bRem, aRem);
    if(!assign) return null;
    aRem.forEach((target,idx)=>groups.push({sources:assign[idx], result:target}));
  }
  return groups.length?groups:null;
}

/* =====================================================================
 * DETECTORS
 * =================================================================== */
const sidesOf=(st)=> st.rel===null ? ['left'] : ['left','right'];

function detectSwap(P,Q){
  if(P.rel===null||Q.rel===null) return null;
  if(Q.rel!==flipRel(P.rel)) return null;
  if(sameMultiset(Q.left,P.right) && sameMultiset(Q.right,P.left)) return {};
  return null;
}
function detectNegate(P,Q){
  if(P.rel===null||Q.rel===null) return null;
  if(Q.rel!==flipRel(P.rel)) return null;
  if(P.left.length===0&&P.right.length===0) return null;
  if(sameMultiset(Q.left,negList(P.left)) && sameMultiset(Q.right,negList(P.right))) return {};
  return null;
}
function detectScale(P,Q){
  if(P.rel===null||Q.rel===null) return null;
  if(P.left.length!==Q.left.length||P.right.length!==Q.right.length) return null;
  const pAll=[...P.left,...P.right], qAll=[...Q.left,...Q.right];
  if(pAll.length===0) return null;
  const ref=pAll.find(t=>t.coef&&!rzero(t.coef)); if(!ref) return null;
  const seen=new Set();
  for(const q of qAll){
    if(groupKey(q)!==groupKey(ref)||rzero(q.coef)) continue;
    const k=rdiv(q.coef, ref.coef); const key=rstr(k);
    if(seen.has(key)) continue; seen.add(key);
    if(req(k,RONE)||req(k,RNEGONE)) continue;
    if(sameMultiset(Q.left,scaleList(P.left,k)) && sameMultiset(Q.right,scaleList(P.right,k))){
      const requiredRel = rnegq(k)?flipRel(P.rel):P.rel;
      if(Q.rel!==requiredRel) return null;
      return {k};
    }
  }
  return null;
}
function detectMove(P,Q){
  if(P.rel===null||Q.rel===null) return null;
  if(P.rel!==Q.rel) return null;
  const diff=(before,after)=>{ const removed=[...before], added=[]; outer: for(const t of after){ for(let i=0;i<removed.length;i++){ if(termEq(removed[i],t)){ removed.splice(i,1); continue outer; } } added.push(t); } return {removed,added}; };
  const L=diff(P.left,Q.left), Rr=diff(P.right,Q.right);
  if(L.removed.length+L.added.length+Rr.removed.length+Rr.added.length===0) return null;
  const moves=[];
  const takeNeg=(term,pool)=>{ for(let i=0;i<pool.length;i++){ if(termEq(pool[i], negTerm(term))){ pool.splice(i,1); return true; } } return false; };
  for(const t of L.removed){ if(!takeNeg(t,Rr.added)) return null; moves.push({term:t,from:'left',to:'right'}); }
  for(const t of Rr.removed){ if(!takeNeg(t,L.added)) return null; moves.push({term:t,from:'right',to:'left'}); }
  if(L.added.length||Rr.added.length) return null;
  return moves.length?{moves}:null;
}
function detectCombine(P,Q){
  if(P.rel!==Q.rel) return null;
  const gl=combineGroups(P.left,Q.left); if(gl===null) return null;
  let gr=[];
  if(P.rel!==null){ gr=combineGroups(P.right,Q.right); if(gr===null) return null; }
  const all=[...gl.map(g=>({...g,side:'left'})), ...gr.map(g=>({...g,side:'right'}))];
  return all.length?{groups:all}:null;
}
function pairwiseRemainder(before, after){
  const remB=[...before], remA=[];
  outer: for(const t of after){ for(let i=0;i<remB.length;i++){ if(termEq(remB[i],t)){ remB.splice(i,1); continue outer; } } remA.push(t); }
  return {remB, remA};
}
function detectEvalInside(P,Q,kind){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side], Q[side]);
    if(remB.length!==1||remA.length!==1) continue;
    const a=remB[0], b=remA[0];
    if(a.kind!==kind||b.kind!==kind||!req(a.coef,b.coef)) continue;
    if(kind==='paren' && !sameSequence(groupOrder(a.inner), a.inner)) continue; // group first
    const g=combineGroups(a.inner, b.inner);
    if(!g) continue;
    return {side, groupId:a.id, newInner:b.inner};
  }
  return null;
}
function detectDistribute(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    for(const A of P[side]){
      if(A.kind!=='paren') continue;
      if(A.inner.some(t=>t.kind!=='num'&&t.kind!=='pow')) continue;
      const rest=P[side].filter(t=>t.id!==A.id);
      const distributed=A.inner.map(t=>({...t, coef:rmul(t.coef,A.coef)}));
      if(!sameMultiset([...rest,...distributed], Q[side])) continue;
      let othersOk=true;
      for(const s2 of sidesOf(P)){ if(s2===side) continue; if(!sameMultiset(P[s2],Q[s2])) othersOk=false; }
      if(!othersOk) continue;
      return {side, parenId:A.id};
    }
  }
  return null;
}

/* ---- lazy arithmetic: multiply a factor into a fraction, evaluate a fraction ---- */
function multiplyInto(scalar, t){
  if(t.kind==='num') return {kind:'num', coef:rmul(scalar,t.coef), sym:t.sym};
  if(t.kind==='frac') return {kind:'frac', num:rmul(scalar,t.num), den:t.den, sym:t.sym};
  if(t.kind==='paren') return {kind:'paren', coef:t.coef, inner:t.inner.map(x=>multiplyInto(scalar,x))};
  if(t.kind==='mul') return {kind:'mul', coef:rmul(scalar,t.coef), factors:t.factors};
  throw new Error('cannot multiply into '+t.kind);
}
function multiplyFactors(a,b){
  if(a.kind==='num') return multiplyInto(a.coef, b);
  if(b.kind==='num') return multiplyInto(b.coef, a);
  if(a.kind==='frac'&&b.kind==='frac') return {kind:'frac', num:rmul(a.num,b.num), den:rmul(a.den,b.den)};
  throw new Error('unsupported multiplication of '+a.kind+' and '+b.kind);
}
function applyScalar(coef, t){
  if(req(coef,RONE)) return t;
  if(t.kind==='paren') return {kind:'paren', coef:rmul(coef,t.coef), inner:t.inner};
  if(t.kind==='mul') return {kind:'mul', coef:rmul(coef,t.coef), factors:t.factors};
  if(t.kind==='num') return {kind:'num', coef:rmul(coef,t.coef), sym:t.sym};
  if(t.kind==='frac') return {kind:'frac', num:rmul(coef,t.num), den:t.den, sym:t.sym};
  if(t.kind==='fracsum') return {kind:'fracsum', coef:rmul(coef,t.coef||RONE), numTerms:t.numTerms, den:t.den};
  if(t.kind==='abs') return {kind:'abs', coef:rmul(coef,t.coef), inner:t.inner};
  if(t.kind==='pow') return t.paren ? {kind:'pow', coef:rmul(coef,t.coef), exp:t.exp, sym:'', paren:t.paren} : {kind:'pow', coef:rmul(coef,t.coef), sym:t.sym, base:t.base, exp:t.exp};
  return t;
}
function reduceMulOnce(m){
  if(m.factors.length<2) return applyScalar(m.coef, m.factors[0]);
  const prod=multiplyFactors(m.factors[0], m.factors[1]);
  const nf=[prod, ...m.factors.slice(2)];
  if(nf.length===1) return applyScalar(m.coef, nf[0]);
  return {kind:'mul', coef:m.coef, factors:nf};
}
function reduceFracOnce(t){
  if(t.kind==='frac') return {kind:'num', coef:rdiv(t.num,t.den), sym:t.sym||''};
  if(t.kind==='paren'){ const i=t.inner.findIndex(x=>x.kind==='frac'); if(i<0) return null;
    const ni=t.inner.slice(); ni[i]={kind:'num',coef:rdiv(ni[i].num,ni[i].den),sym:''};
    return {kind:'paren',coef:t.coef,inner:ni}; }
  if(t.kind==='mul'){ const i=t.factors.findIndex(x=>x.kind==='frac'); if(i<0) return null;
    const nf=t.factors.slice(); nf[i]={kind:'num',coef:rdiv(nf[i].num,nf[i].den),sym:''};
    return {kind:'mul',coef:t.coef,factors:nf}; }
  return null;
}
function detectMultiply(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side],Q[side]);
    if(remB.length!==1||remA.length!==1) continue;
    const a=remB[0], b=remA[0];
    if(a.kind!=='mul') continue;
    let red; try{ red=reduceMulOnce(a); }catch(e){ continue; }
    if(termEq(red,b)) return {side, id:a.id, result:red};
  }
  return null;
}
function detectEvalFrac(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side],Q[side]);
    if(remB.length!==1||remA.length!==1) continue;
    const a=remB[0], b=remA[0];
    const red=reduceFracOnce(a);
    if(red && termEq(red,b)) return {side, id:a.id, result:red};
  }
  return null;
}


/* ---- powers & factoring (polynomial layer) ---- */
function polyEq(a,b){ const ks=new Set([...Object.keys(a),...Object.keys(b)]); for(const k of ks){ if(!req(a[k]||RZERO, b[k]||RZERO)) return false; } return true; }
function isProductOfParens(t){ return t.kind==='mul' && t.factors.length>=2 && t.factors.every(f=>f.kind==='paren'); }
function isFactoredForm(t){ return t.kind==='mul' && t.factors.length>=2 && t.factors.every(f=> f.kind==='paren' || (f.kind==='num' && f.sym!=='') || (f.kind==='pow' && f.sym!=='')); }
function detectRewritePower(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side],Q[side]);
    if(remB.length!==1||remA.length!==1) continue;
    const a=remB[0], b=remA[0];
    if(a.kind==='num'&&a.sym===''&&b.kind==='pow'&&b.sym===''&&req(a.coef,rmul(b.coef,ipow(b.base,b.exp)))) return {side,id:a.id,result:b,dir:'rewrite'};
    if(a.kind==='pow'&&a.sym===''&&b.kind==='num'&&b.sym===''&&req(b.coef,rmul(a.coef,ipow(a.base,a.exp)))) return {side,id:a.id,result:b,dir:'eval'};
  }
  return null;
}
function detectReorderFactors(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side],Q[side]);
    if(remB.length!==1||remA.length!==1) continue;
    const a=remB[0], b=remA[0];
    if(a.kind!=='mul'||b.kind!=='mul'||!req(a.coef,b.coef)||a.factors.length!==b.factors.length) continue;
    if(sameMultiset(a.factors,b.factors) && !sameSequence(a.factors,b.factors)) return {side,id:a.id,result:b};
  }
  return null;
}
function rootOfFactor(f){
  if(f.kind==='num' && f.sym!=='') return RZERO;
  if(f.kind==='pow' && f.sym!=='') return RZERO;
  if(f.kind==='paren'){ const p=polyClean(normalForm(f.inner)); const ks=Object.keys(p);
    const lin=ks.filter(k=>/^[a-zA-Z]\^1$/.test(k));
    if(lin.length!==1) return null;
    if(ks.some(k=>k!=='' && !/^[a-zA-Z]\^1$/.test(k))) return null;
    const a=p[lin[0]], b=p['']||RZERO; if(rzero(a)) return null;
    return rneg(rdiv(b,a)); }
  return null;
}
function detectZeroProduct(P,Q){
  if(Q.rel!=='=' || !Q.right || Q.right.length!==1 || Q.right[0].kind!=='set') return null;
  if(!Q.left || Q.left.length!==1 || Q.left[0].kind!=='num' || Q.left[0].sym==='') return null;
  for(const side of sidesOf(P)){
    const other=side==='left'?'right':'left';
    if(P[side].length!==1) continue;
    const prod=P[side][0]; if(!isFactoredForm(prod)) continue;
    if(P[other] && P[other].length!==0) continue;
    const roots=prod.factors.map(rootOfFactor); if(roots.some(r=>r===null)) continue;
    const got=[...new Set(roots.map(rstr))].sort(), want=Q.right[0].values.map(rstr).slice().sort();
    if(got.length===want.length && got.every((x,i)=>x===want[i])) return {productId:prod.id};
  }
  return null;
}
function detectAbsSplit(P,Q){
  if(P.kind==='branches' || Q.kind!=='branches' || Q.branches.length!==2) return null;
  if(P.rel!=='=') return null;
  const constOf=(arr)=>{ const p=polyClean(normalForm(arr||[])); if(Object.keys(p).some(k=>k!=='')) return null; return p['']||RZERO; };
  for(const side of sidesOf(P)){
    const other=side==='left'?'right':'left';
    if(P[side].length!==1) continue;
    const ab=P[side][0]; if(ab.kind!=='abs' || !req(ab.coef,RONE)) continue;
    const k=constOf(P[other]); if(k===null) continue;
    const exprPoly=polyClean(normalForm(ab.inner));
    const b0=Q.branches[0], b1=Q.branches[1];
    if(b0.kind==='branches'||b1.kind==='branches'||b0.rel!=='='||b1.rel!=='=') continue;
    const okBranch=(b,rhs)=>{ const c=constOf(b.right); return c!==null && req(c,rhs) && polyEq(polyClean(normalForm(b.left)), exprPoly); };
    if((okBranch(b0,k)&&okBranch(b1,rneg(k))) || (okBranch(b0,rneg(k))&&okBranch(b1,k))) return {absId:ab.id};
  }
  return null;
}
function detectBranchSplit(P,Q){
  if(P.kind==='branches' || Q.kind!=='branches') return null;
  for(const side of sidesOf(P)){
    const other=side==='left'?'right':'left';
    if(P[side].length!==1) continue;
    const prod=P[side][0]; if(!isFactoredForm(prod)) continue;
    if(P[other] && P[other].length!==0) continue;
    if(Q.branches.length!==prod.factors.length) continue;
    let ok=true;
    for(let k=0;k<prod.factors.length;k++){
      const b=Q.branches[k];
      if(!b || b.kind==='branches' || b.rel!=='=' || (b.right && b.right.length!==0)){ ok=false; break; }
      if(!polyEq(polyClean(termPoly(prod.factors[k])), polyClean(normalForm(b.left)))){ ok=false; break; }
    }
    if(ok) return {productId:prod.id, factorIds:prod.factors.map(f=>f.id)};
  }
  return null;
}
function detectFactor(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side],Q[side]);
    if(remA.length!==1||remB.length<1) continue;
    const b=remA[0];
    if(!isFactoredForm(b)) continue;
    if(polyEq(normalForm(remB), normalForm([b]))) return {side, remIds:remB.map(t=>t.id), firstIdx:P[side].findIndex(t=>t.id===remB[0].id), result:b};
  }
  return null;
}
function detectExpand(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side],Q[side]);
    if(remB.length!==1||remA.length<1) continue;
    const a=remB[0];
    if(!isProductOfParens(a)) continue;
    if(polyEq(normalForm([a]), normalForm(remA))) return {side, id:a.id, idx:P[side].findIndex(t=>t.id===a.id), resultTerms:remA};
  }
  return null;
}


function flattenSub(parentInner, i){ const s=parentInner[i]; const flat=s.inner.map(t=>req(s.coef,RNEGONE)?{...t,coef:rneg(t.coef)}:t); return [...parentInner.slice(0,i), ...flat, ...parentInner.slice(i+1)]; }
function detectFlatten(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side],Q[side]);
    if(remB.length!==1||remA.length!==1) continue;
    const a=remB[0], b=remA[0];
    if(a.kind!=='paren'||b.kind!=='paren'||!req(a.coef,b.coef)) continue;
    for(let i=0;i<a.inner.length;i++){
      const s=a.inner[i];
      if(s.kind!=='paren'||(!req(s.coef,RONE)&&!req(s.coef,RNEGONE))) continue;
      if(sameMultiset(flattenSub(a.inner,i), b.inner)) return {side, parenId:a.id, subId:s.id, idx:i};
    }
  }
  return null;
}


function detectReorderInside(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    if(P[side].length!==Q[side].length) continue;
    let found=null, ok=true;
    for(let i=0;i<P[side].length;i++){
      const a=P[side][i], b=Q[side][i];
      if(a.kind==='paren'&&b.kind==='paren'&&req(a.coef,b.coef)&&sameMultiset(a.inner,b.inner)&&!sameSequence(a.inner,b.inner)){
        if(found){ok=false;break;} found={side, id:a.id, target:b};
      } else if(!strictTermEq(a,b)){ ok=false; break; }
    }
    if(ok&&found) return found;
  }
  return null;
}


/* ---- fraction addition (lazy //): common denominator, add same-denominator, unwrap ---- */
function lcmI(a,b){ return Math.abs(a*b)/gcd(a,b); }
function fracIntDen(f){ return f.kind==='frac' && f.num.d===1 && f.den.d===1; }
function rescaleFracsToLCD(arr, includeNums){
  const fracLike=t=> t.kind==='frac' || (includeNums && t.kind==='num' && t.coef.d===1);
  const fl=arr.filter(fracLike);
  const fracs=arr.filter(t=>t.kind==='frac');
  if(fl.length<2 || fracs.length<1 || !fracs.every(fracIntDen)) return null;
  const dens=fl.map(t=> t.kind==='frac' ? t.den.n : 1);
  if(new Set(dens).size===1) return null;
  let L=dens[0]; for(let i=1;i<dens.length;i++) L=lcmI(L,dens[i]);
  return arr.map(t=>{
    if(t.kind==='frac') return {kind:'frac', num:R(t.num.n*(L/t.den.n)), den:R(L), id:t.id, sym:t.sym};
    if(includeNums && t.kind==='num' && t.coef.d===1) return {kind:'frac', num:R(t.coef.n*L), den:R(L), id:t.id, sym:t.sym};
    return t;
  });
}
function addFracsInList(arr){
  const fracs=arr.filter(t=>t.kind==='frac');
  if(fracs.length<2 || !fracs.every(fracIntDen)) return null;
  const dens=fracs.map(f=>f.den.n);
  if(new Set(dens).size!==1) return null; // need a common denominator first
  const D=dens[0], sum=fracs.reduce((s,f)=>s+f.num.n,0);
  const survivor={kind:'frac', num:R(sum), den:R(D), id:fracs[0].id};
  const out=[]; let placed=false;
  for(const t of arr){ if(t.kind==='frac'){ if(!placed){ out.push(survivor); placed=true; } } else out.push(t); }
  return out;
}
/* combine same-denominator lazy fractions onto one shared bar, numerator kept as an UNEVALUATED sum */
function combineFracsInList(arr){
  const fracs=arr.filter(t=>t.kind==='frac');
  if(fracs.length<2 || !fracs.every(fracIntDen)) return null;
  const dens=fracs.map(f=>f.den.n);
  if(new Set(dens).size!==1) return null; // must already share a denominator
  const D=fracs[0].den;
  const numTerms=fracs.map(f=>({kind:'num', coef:f.num, sym:f.sym||''}));
  const fs={kind:'fracsum', coef:RONE, numTerms, den:D, id:fracs[0].id};
  const out=[]; let placed=false;
  for(const t of arr){ if(t.kind==='frac'){ if(!placed){ out.push(fs); placed=true; } } else out.push(t); }
  return out;
}
/* evaluate a fracsum's numerator sum -> a plain lazy fraction (only when its coefficient is 1) */
function evalFracsumInList(arr){
  const i=arr.findIndex(t=>t.kind==='fracsum');
  if(i<0) return null;
  const fs=arr[i];
  if(!req(fs.coef||RONE, RONE)) return null;
  const poly=normalForm(fs.numTerms); const ks=Object.keys(poly).filter(k=>!rzero(poly[k]));
  if(ks.length===0){ const out=arr.slice(); out[i]={kind:'frac', num:RZERO, den:fs.den, id:fs.id, sym:''}; return out; }
  if(ks.length>1) return null;
  const k=ks[0]; const c=poly[k]; let sym='';
  if(k!==''){ const mm=/^([a-zA-Z])\^1$/.exec(k); if(!mm) return null; sym=mm[1]; }
  const out=arr.slice(); out[i]={kind:'frac', num:c, den:fs.den, id:fs.id, sym};
  return out;
}
function reduceFracInList(arr){
  for(let i=0;i<arr.length;i++){ const t=arr[i];
    if(t.kind==='frac' && fracIntDen(t)){
      const g=gcd(Math.abs(t.num.n), Math.abs(t.den.n));
      if(g>1 && Math.abs(t.den.n)/g!==1){ const out=arr.slice(); out[i]={kind:'frac', num:R(t.num.n/g), den:R(t.den.n/g), id:t.id, sym:t.sym}; return {out, id:t.id}; }
    }
  }
  return null;
}
function detectReduceFraction(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const r=reduceFracInList(P[side]);
    if(r){ const cand={...P,[side]:r.out}; if(relEqStates(cand,Q)) return {cand, fracId:r.id}; }
    for(let i=0;i<P[side].length;i++){ const a=P[side][i]; if(a.kind!=='paren') continue;
      const ri=reduceFracInList(a.inner); if(!ri) continue;
      const ns=P[side].slice(); ns[i]={...a,inner:ri.out}; const cand={...P,[side]:ns};
      if(relEqStates(cand,Q)) return {cand, fracId:ri.id}; }
  }
  return null;
}
function detectCombineFractions(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const r=combineFracsInList(P[side]);
    if(r){ const cand={...P,[side]:r}; if(relEqStates(cand,Q)) return {cand, sourceIds:P[side].filter(t=>t.kind==='frac').map(t=>t.id), resultId:r.find(t=>t.kind==='fracsum').id}; }
    for(let i=0;i<P[side].length;i++){ const a=P[side][i]; if(a.kind!=='paren') continue;
      const ri=combineFracsInList(a.inner); if(!ri) continue;
      const ns=P[side].slice(); ns[i]={...a,inner:ri}; const cand={...P,[side]:ns};
      if(relEqStates(cand,Q)) return {cand, sourceIds:a.inner.filter(t=>t.kind==='frac').map(t=>t.id), resultId:ri.find(t=>t.kind==='fracsum').id}; }
  }
  return null;
}
function detectEvalNumerator(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const r=evalFracsumInList(P[side]);
    if(r){ const cand={...P,[side]:r}; if(relEqStates(cand,Q)){ const fs=P[side].find(t=>t.kind==='fracsum'); return {cand, fracsumId:fs.id}; } }
    for(let i=0;i<P[side].length;i++){ const a=P[side][i]; if(a.kind!=='paren') continue;
      const ri=evalFracsumInList(a.inner); if(!ri) continue;
      const ns=P[side].slice(); ns[i]={...a,inner:ri}; const cand={...P,[side]:ns};
      if(relEqStates(cand,Q)){ const fs=a.inner.find(t=>t.kind==='fracsum'); return {cand, fracsumId:fs.id}; } }
  }
  return null;
}
function detectCommonDenom(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const r=rescaleFracsToLCD(P[side], true);
    if(r){ const cand={...P,[side]:r}; if(relEqStates(cand,Q)) return {cand, fracIds:r.filter(t=>t.kind==='frac').map(t=>t.id)}; }
    for(let i=0;i<P[side].length;i++){ const a=P[side][i]; if(a.kind!=='paren') continue;
      const ri=rescaleFracsToLCD(a.inner, true); if(!ri) continue;
      const ns=P[side].slice(); ns[i]={...a,inner:ri}; const cand={...P,[side]:ns};
      if(relEqStates(cand,Q)) return {cand, fracIds:ri.filter(t=>t.kind==='frac').map(t=>t.id)};
    }
  }
  return null;
}
function detectAddFractions(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const r=addFracsInList(P[side]);
    if(r){ const cand={...P,[side]:r}; if(relEqStates(cand,Q)) return {cand, sourceIds:P[side].filter(t=>t.kind==='frac').map(t=>t.id), resultId:r.find(t=>t.kind==='frac').id}; }
    for(let i=0;i<P[side].length;i++){ const a=P[side][i]; if(a.kind!=='paren') continue;
      const ri=addFracsInList(a.inner); if(!ri) continue;
      const ns=P[side].slice(); ns[i]={...a,inner:ri}; const cand={...P,[side]:ns};
      if(relEqStates(cand,Q)) return {cand, sourceIds:a.inner.filter(t=>t.kind==='frac').map(t=>t.id), resultId:ri.find(t=>t.kind==='frac').id};
    }
  }
  return null;
}
function detectUnwrapParen(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    for(let i=0;i<P[side].length;i++){ const a=P[side][i];
      if(a.kind!=='paren'||a.inner.length!==1) continue;
      const inner=a.inner[0]; if(inner.kind!=='frac'&&inner.kind!=='mul'&&inner.kind!=='fracsum') continue;
      if(!req(a.coef,RONE)&&!req(a.coef,RNEGONE)) continue;
      const promoted=req(a.coef,RNEGONE)?applyScalar(RNEGONE,inner):inner;
      const ns=P[side].slice(); ns[i]={...promoted,id:a.id}; const cand={...P,[side]:ns};
      if(relEqStates(cand,Q)) return {cand, parenId:a.id};
    }
  }
  return null;
}


function detectExpandSquare(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side],Q[side]);
    const pows=remB.filter(t=>t.kind==='pow'&&t.paren);
    if(remB.length!==1||pows.length!==1) continue;
    const a=pows[0];
    const expandPoly=polyPow(normalForm(a.paren), a.exp);
    if(remA.length===1 && remA[0].kind==='paren' && req(remA[0].coef,a.coef) && polyEq(expandPoly, normalForm(remA[0].inner))){
      const idx=P[side].findIndex(t=>t.id===a.id); const ns=P[side].slice();
      ns[idx]={kind:'paren',coef:a.coef,inner:assignIds(remA[0].inner.map(copyTerm)),id:a.id};
      return {side, id:a.id, next:{...P,[side]:ns}};
    }
    if((req(a.coef,RONE)||req(a.coef,RNEGONE)) && polyEq(polyScale(expandPoly,a.coef), normalForm(remA))){
      const idx=P[side].findIndex(t=>t.id===a.id); const ns=P[side].slice();
      ns.splice(idx,1,...assignIds(remA.map(copyTerm)));
      return {side, id:a.id, next:{...P,[side]:ns}};
    }
  }
  return null;
}

function detectApplyAbs(P,Q){
  if(P.rel!==Q.rel) return null;
  for(const side of sidesOf(P)){
    const {remB,remA}=pairwiseRemainder(P[side], Q[side]);
    if(remB.length!==1||remA.length!==1) continue;
    const a=remB[0], b=remA[0];
    if(a.kind!=='abs'||b.kind!=='num'||b.sym!=='') continue;
    const nf=normalForm(a.inner);
    const keys=Object.keys(nf);
    if(keys.length>1 || (keys.length===1&&keys[0]!=='')) continue; // variable inside → needs case split
    const innerVal=keys.length?nf['']:RZERO;
    const result=rmul(a.coef, rabs(innerVal));
    if(!req(b.coef, result)) continue;
    return {side, absId:a.id, result};
  }
  return null;
}

/* =====================================================================
 * PLANNER
 * =================================================================== */
function strictTermEq(a,b){
  if(a.kind!==b.kind) return false;
  if(a.kind==='num') return a.sym===b.sym&&req(a.coef,b.coef);
  if(a.kind==='frac') return req(a.num,b.num)&&req(a.den,b.den)&&(a.sym||'')===(b.sym||'');
  if(a.kind==='fracsum') return req(a.coef||RONE,b.coef||RONE)&&req(a.den,b.den)&&a.numTerms.length===b.numTerms.length&&a.numTerms.every((t,i)=>strictTermEq(t,b.numTerms[i]));
  if(a.kind==='pow'){ if(a.paren||b.paren) return !!a.paren===!!b.paren&&req(a.coef,b.coef)&&a.exp===b.exp&&a.paren.length===b.paren.length&&a.paren.every((t,i)=>strictTermEq(t,b.paren[i])); return req(a.coef,b.coef)&&a.sym===b.sym&&a.exp===b.exp&&(a.sym!==''||req(a.base,b.base)); }
  if(a.kind==='mul') return req(a.coef,b.coef)&&a.factors.length===b.factors.length&&a.factors.every((f,i)=>strictTermEq(f,b.factors[i]));
  if(a.kind==='set'){ const sa=a.values.map(rstr).slice().sort(), sb=b.values.map(rstr).slice().sort(); return sa.length===sb.length&&sa.every((x,i)=>x===sb[i]); }
  return req(a.coef,b.coef)&&a.inner.length===b.inner.length&&a.inner.every((t,i)=>strictTermEq(t,b.inner[i]));
}
function strictSeq(a,b){ return a.length===b.length&&a.every((t,i)=>strictTermEq(t,b[i])); }
function isConstTerm(t){ return (t.kind==='num'&&t.sym==='')||(t.kind==='pow'&&t.sym==='')||t.kind==='frac'||t.kind==='fracsum'; }
function groupOrder(inner){ return [...inner.filter(t=>!isConstTerm(t)), ...inner.filter(isConstTerm)]; }
function relEqStates(P,Q){
  if(P.kind==='branches'||Q.kind==='branches'){
    if(P.kind!=='branches'||Q.kind!=='branches'||P.branches.length!==Q.branches.length) return false;
    return P.branches.every((b,i)=>relEqStates(b,Q.branches[i]));
  }
  if(P.rel!==Q.rel) return false;
  if(!strictSeq(P.left,Q.left)) return false;
  if(P.rel===null) return true;
  return strictSeq(P.right,Q.right);
}
function statesReorder(P,Q){
  if(P.rel!==Q.rel) return false;
  if(!sameMultiset(P.left,Q.left)) return false;
  if(P.rel!==null && !sameMultiset(P.right,Q.right)) return false;
  const lSame=sameSequence(P.left,Q.left);
  const rSame=(P.rel===null)||sameSequence(P.right,Q.right);
  return !(lSame&&rSame);
}
function replaceById(side, id, newTerm){ return side.map(t=> t.id===id ? {...newTerm, id} : t); }


/* =====================================================================
 * CANONICAL SIMPLIFIER + BRIDGE (auto-fill granular steps between two
 * checkpoints that are several ops apart). Follows a fixed solving order
 * so the generated intermediates match what a teacher would write, and
 * only succeeds if it lands EXACTLY on the author's next checkpoint.
 * =================================================================== */
function copyTerm(t){
  if(t.kind==='set') return {kind:'set', values:t.values.slice()};
  if(t.kind==='fracsum') return {kind:'fracsum', coef:t.coef||RONE, numTerms:t.numTerms.map(copyTerm), den:t.den};
  if(t.kind==='pow') return t.paren ? {kind:'pow', coef:t.coef, exp:t.exp, sym:'', paren:t.paren.map(copyTerm)} : {kind:'pow', coef:t.coef, sym:t.sym, base:t.base, exp:t.exp};
  const c={kind:t.kind, coef:t.coef, sym:t.sym};
  if(t.inner) c.inner=t.inner.map(copyTerm);
  if(t.factors) c.factors=t.factors.map(copyTerm);
  if(t.kind==='frac'){ c.num=t.num; c.den=t.den; }
  return c;
}
function copyState(st){ return {left:st.left.map(copyTerm), rel:st.rel, right: st.rel===null?null:st.right.map(copyTerm)}; }
const isConst=(t)=> t.kind==='num' && t.sym==='';
function firstCombinableGroup(terms){
  const byKey={};
  terms.forEach(t=>{ const k=groupKey(t); (byKey[k]=byKey[k]||[]).push(t); });
  let best=null, bestIdx=Infinity;
  for(const k of Object.keys(byKey)){
    const grp=byKey[k];
    if(grp.length>=2){ const fi=terms.indexOf(grp[0]); if(fi<bestIdx){ bestIdx=fi; best=grp; } }
  }
  return best;
}
function simplifyOnce(st){
  // 0. lazy arithmetic: do one multiplication, then evaluate one fraction
  for(const side of sidesOf(st)){
    const mi=st[side].findIndex(t=>t.kind==='mul');
    if(mi>=0){ let red; try{ red=reduceMulOnce(st[side][mi]); }catch(e){ red=null; } if(red){ const ns=st[side].slice(); ns[mi]=red; return {...st,[side]:ns}; } }
  }
  // 0a0. lazy fractions: common denominator -> add -> unwrap (before reducing any single fraction)
  for(const side of sidesOf(st)){
    const r=rescaleFracsToLCD(st[side]); if(r) return {...st,[side]:r};
    for(let i=0;i<st[side].length;i++){ const a=st[side][i]; if(a.kind==='paren'){ const ri=rescaleFracsToLCD(a.inner); if(ri){ const ns=st[side].slice(); ns[i]={...a,inner:ri}; return {...st,[side]:ns}; } } }
  }
  for(const side of sidesOf(st)){
    const r=combineFracsInList(st[side]); if(r) return {...st,[side]:r};
    for(let i=0;i<st[side].length;i++){ const a=st[side][i]; if(a.kind==='paren'){ const ri=combineFracsInList(a.inner); if(ri){ const ns=st[side].slice(); ns[i]={...a,inner:ri}; return {...st,[side]:ns}; } } }
  }
  for(const side of sidesOf(st)){
    const r=evalFracsumInList(st[side]); if(r) return {...st,[side]:r};
    for(let i=0;i<st[side].length;i++){ const a=st[side][i]; if(a.kind==='paren'){ const ri=evalFracsumInList(a.inner); if(ri){ const ns=st[side].slice(); ns[i]={...a,inner:ri}; return {...st,[side]:ns}; } } }
  }
  for(const side of sidesOf(st)){
    for(let i=0;i<st[side].length;i++){ const a=st[side][i];
      if(a.kind==='paren'&&a.inner.length===1&&(req(a.coef,RONE)||req(a.coef,RNEGONE))){ const inner=a.inner[0];
        if(inner.kind==='frac'||inner.kind==='mul'||inner.kind==='fracsum'){ const promoted=req(a.coef,RNEGONE)?applyScalar(RNEGONE,inner):inner; const ns=st[side].slice(); ns[i]=promoted; return {...st,[side]:ns}; } } }
  }
  for(const side of sidesOf(st)){
    const r=reduceFracInList(st[side]); if(r) return {...st,[side]:r.out};
    for(let i=0;i<st[side].length;i++){ const a=st[side][i]; if(a.kind==='paren'){ const ri=reduceFracInList(a.inner); if(ri){ const ns=st[side].slice(); ns[i]={...a,inner:ri.out}; return {...st,[side]:ns}; } } }
  }
  for(const side of sidesOf(st)){
    const fi=st[side].findIndex(t=>reduceFracOnce(t)!==null);
    if(fi>=0){ const red=reduceFracOnce(st[side][fi]); const ns=st[side].slice(); ns[fi]=red; return {...st,[side]:ns}; }
  }
  // 0b. flatten a redundant nested bracket (coef ±1) inside a paren
  for(const side of sidesOf(st)){
    for(let pi=0; pi<st[side].length; pi++){
      const p=st[side][pi];
      if(p.kind!=='paren') continue;
      const si=p.inner.findIndex(s=>s.kind==='paren' && (req(s.coef,RONE)||req(s.coef,RNEGONE)));
      if(si>=0){ const np={...p, inner:flattenSub(p.inner, si)}; const ns=st[side].slice(); ns[pi]=np; return {...st,[side]:ns}; }
    }
  }
  // 0c. inside a bracket: GROUP like terms (vars left, nums right), then combine
  for(const side of sidesOf(st)){
    for(let pi=0; pi<st[side].length; pi++){
      const p=st[side][pi];
      if(p.kind!=='paren') continue;
      const g=firstCombinableGroup(p.inner);
      if(g){
        const grouped=groupOrder(p.inner);
        if(!sameSequence(grouped, p.inner)){ const ns=st[side].slice(); ns[pi]={...p, inner:grouped}; return {...st,[side]:ns}; }
        const sum=g.reduce((a,t)=>radd(a,t.coef),RZERO); const first=g[0];
        let ninner;
        if(rzero(sum)&&first.kind!=='abs'){ ninner=p.inner.filter(t=>!g.includes(t)); }
        else { const fused=first.kind==='abs'?{kind:'abs',coef:sum,inner:first.inner.map(copyTerm)}:{kind:'num',coef:sum,sym:first.sym}; ninner=[]; let placed=false; for(const t of p.inner){ if(g.includes(t)){ if(!placed){ninner.push(fused);placed=true;} } else ninner.push(t); } }
        const ns=st[side].slice(); ns[pi]={...p, inner:ninner}; return {...st,[side]:ns};
      }
    }
  }
  // 0d. expand a squared/powered bracket: (..)^n -> ( expanded polynomial )
  for(const side of sidesOf(st)){
    for(let i=0;i<st[side].length;i++){ const t=st[side][i];
      if(t.kind==='pow'&&t.paren){ const expanded=assignIds(polyToTerms(polyScale(polyPow(normalForm(t.paren),t.exp), RONE))); const ns=st[side].slice(); ns[i]={kind:'paren',coef:t.coef,inner:expanded,id:t.id}; return {...st,[side]:ns}; } }
  }
  // 1. distribute the leftmost parentheses
  for(const side of sidesOf(st)){
    const p=st[side].find(t=>t.kind==='paren'&&t.inner.every(x=>x.kind==='num'||x.kind==='pow'));
    if(p){
      const rest=st[side].filter(t=>t!==p);
      const dist=p.inner.map(t=>({...t, coef:rmul(t.coef,p.coef)}));
      const ns=[]; let placed=false;
      for(const t of st[side]){ if(t===p){ if(!placed){ ns.push(...dist); placed=true; } } else ns.push(t); }
      return {...st, [side]:ns};
    }
  }
  // 2. combine the leftmost group of like terms (left side first, then right)
  for(const side of sidesOf(st)){
    const g=firstCombinableGroup(st[side]);
    if(g){
      const sum=g.reduce((acc,t)=>radd(acc,t.coef), RZERO);
      const first=g[0];
      if(rzero(sum) && first.kind!=='abs'){ return {...st, [side]: st[side].filter(t=>!g.includes(t))}; }
      const fused = first.kind==='abs' ? {kind:'abs',coef:sum,inner:first.inner.map(copyTerm)} : {kind:'num',coef:sum,sym:first.sym};
      const ns=[]; let placed=false;
      for(const t of st[side]){ if(g.includes(t)){ if(!placed){ ns.push(fused); placed=true; } } else ns.push(t); }
      return {...st, [side]:ns};
    }
  }
  if(st.rel!==null){
    // 3a. bring a variable term from the right over to the left
    const rv=st.right.find(t=>!isConst(t));
    if(rv) return {...st, left:[...st.left, {...rv, coef:rneg(rv.coef)}], right:st.right.filter(t=>t!==rv)};
    // 3b. send a constant from the left over to the right (only if left still has a non-constant)
    const leftHasVar=st.left.some(t=>!isConst(t));
    const lc=st.left.find(t=>isConst(t));
    if(lc && leftHasVar) return {...st, left:st.left.filter(t=>t!==lc), right:[...st.right, {...lc, coef:rneg(lc.coef)}]};
    // 4. divide to isolate the variable
    if(st.left.length===1 && st.left[0].kind==='num' && st.left[0].sym!=='' && !req(st.left[0].coef,RONE)){
      const c=st.left[0].coef; const scl=(arr)=>arr.map(t=>({...t, coef:rdiv(t.coef,c)}));
      return {...st, left:scl(st.left), right:scl(st.right)};
    }
  }
  return null;
}
function ensureIds(st){
  if(st.kind==='branches') return {kind:'branches', branches:st.branches.map(ensureIds)};
  const fix=(arr)=>arr.map(t=>{ const c={...t}; if(c.id===undefined) c.id=newId(); if(c.inner) c.inner=fix(c.inner); if(c.paren) c.paren=fix(c.paren); if(c.factors) c.factors=fix(c.factors); if(c.numTerms) c.numTerms=fix(c.numTerms); return c; });
  return {...st, left:fix(st.left), right: st.rel===null?null:fix(st.right)};
}

function bridge(P, Q){
  if(P.kind==='branches'||Q.kind==='branches') return null;
  const hasSet=(st)=> st.left.some(t=>t.kind==='set') || (st.right&&st.right.some(t=>t.kind==='set'));
  if(hasSet(P)||hasSet(Q)) return null;  // solution sets are terminal; can't auto-fill into/out of them
  const matches=(a,b)=> a.rel===b.rel && sameMultiset(a.left,b.left) && (a.rel===null||sameMultiset(a.right,b.right));
  let cur=copyState(P);
  const path=[]; const MAX=40;
  if(matches(cur,Q)) return path;
  for(let i=0;i<MAX;i++){
    const nxt=simplifyOnce(cur);
    if(!nxt) return null;            // fully simplified without hitting Q
    if(matches(nxt,Q)) return path;  // reached Q; intermediates are in `path`
    path.push(nxt);
    cur=nxt;
  }
  return null;
}

function plan(stateStrs){
  idCounter=0;
  if(stateStrs.length<2) throw new Error('Provide at least two states (one per line).');
  const raw=stateStrs.map((s,i)=>parseStatement(s,i+1));
  // relation consistency: plain stays plain; relational stays relational
  const firstRel=raw[0].rel;
  for(let j=1;j<raw.length;j++){
    if(raw[j].kind==='branches') continue;
    if((raw[j].rel===null)!==(firstRel===null))
      throw new Error(`Line ${j+1}: you can't switch between a plain expression and one with =/<>/\u2264/\u2265 partway through.`);
  }

  let cur=assignState(raw[0]);
  const initial=cur;
  const steps=[];

  function stepsForBranch(P,Q,label,pStr,qStr){
    const acc=[]; let c=P; let guard=0;
    while(!relEqStates(c,Q)){
      if(guard++>30) return null;
      const res=buildPair(c,Q,label,pStr,qStr);
      if(res.multiOp){
        const path=bridge(c,Q); if(!path) return null;
        for(const mid of [...path,Q]){ if(relEqStates(c,mid)) continue; const r=buildPair(c,mid,label,pStr,qStr); if(r.multiOp) return null; for(const s of r.steps) acc.push(s); c=ensureIds(r.next); }
        break;
      } else { for(const s of res.steps) acc.push(s); c=ensureIds(res.next); }
    }
    return acc;
  }
  function buildPair(P, Q, label, pStr, qStr){
    const out=[];

    if(P.kind==='branches' || Q.kind==='branches'){
      if(P.kind!=='branches' && Q.kind==='branches'){
        const sp=detectBranchSplit(P,Q);
        if(sp){ const Qi=ensureIds(Q);
          out.push({type:'highlight',termIds:sp.factorIds,group:true,caption:`Look at each factor on its own \u2014 a product is zero only if one of the factors is zero.`});
          out.push({type:'branchSplit',productId:sp.productId,after:Qi,caption:`Set each factor equal to zero \u2014 split into one equation per factor.`});
          return {steps:out,next:Qi}; }
        const as=detectAbsSplit(P,Q);
        if(as){ const Qi=ensureIds(Q);
          out.push({type:'highlight',termIds:[as.absId],group:true,caption:`|A| = k means A sits k away from zero \u2014 so A = +k or A = \u2212k.`});
          out.push({type:'absSplit',absId:as.absId,after:Qi,caption:`Drop the bars and split into two cases: A = k and A = \u2212k.`});
          return {steps:out,next:Qi}; }
        return {multiOp:true};
      }
      if(P.kind==='branches' && Q.kind==='branches' && P.branches.length===Q.branches.length){
        const changed=[]; for(let i=0;i<P.branches.length;i++) if(!relEqStates(P.branches[i],Q.branches[i])) changed.push(i);
        if(changed.length===0) return {steps:[],next:Q};
        if(changed.length>1) return {multiOp:true};
        const bi=changed[0];
        const sub=stepsForBranch(P.branches[bi],Q.branches[bi],label,pStr,qStr);
        if(!sub) return {multiOp:true};
        let cb=P.branches.slice(); const lifted=[];
        for(const s of sub){ if(!s.after) continue; cb=cb.slice(); cb[bi]=s.after; lifted.push({...s, branchIndex:bi, after:{kind:'branches',branches:cb.slice()}}); }
        if(lifted.length===0) return {multiOp:true};
        return {steps:lifted,next:lifted[lifted.length-1].after};
      }
      return {multiOp:true};
    }

    if(statesReorder(P,Q)){
      const nx={ left:matchTerms(Q.left,P.left), rel:Q.rel, right:P.rel===null?null:matchTerms(Q.right,P.right) };
      if(nx.left && (P.rel===null||nx.right)){
        out.push({type:'reorder', after:nx, caption:'Rearrange so the like terms sit next to each other \u2014 adding in a different order doesn\u2019t change the result.'});
        return {steps:out, next:nx};
      }
    }

    { const ri=detectReorderInside(P,Q);
      if(ri){ const pPar=P[ri.side].find(t=>t.id===ri.id); const pool=[...pPar.inner]; const newInner=[];
        for(const qt of ri.target.inner){ const idx=pool.findIndex(t=>termEq(t,qt)); newInner.push(pool[idx]); pool.splice(idx,1); }
        const newParen={...pPar, inner:newInner}; const next={...P,[ri.side]:replaceById(P[ri.side],ri.id,newParen)};
        const movers=newInner.filter(t=>!isConstTerm(t)).map(t=>t.id);
        out.push({type:'highlight',termIds:movers,group:true,caption:`Group like terms: variables first, then the numbers.`});
        out.push({type:'reorderInside',parenId:ri.id,after:next,caption:`Rearrange inside the bracket so like terms sit together.`});
        return {steps:out,next}; } }

    { const ap=detectApplyAbs(P,Q);
      if(ap){ const next={...P,[ap.side]:replaceById(P[ap.side],ap.absId,{kind:'num',coef:ap.result,sym:''})};
        out.push({type:'highlight',termIds:[ap.absId],group:true,caption:`The absolute value makes a number positive (its distance from zero).`});
        out.push({type:'applyAbs',termId:ap.absId,after:next,caption:`Drop the bars: the value becomes ${fmtTerm({kind:'num',coef:ap.result,sym:''},{withSign:false})}.`});
        return {steps:out,next}; } }

    { const ev=detectEvalInside(P,Q,'abs');
      if(ev){ const src=P[ev.side].find(t=>t.id===ev.groupId);
        const newInnerIds=assignIds(ev.newInner);
        const mn=[...newInnerIds], sourceTerms=[]; for(const s of src.inner){ const j=mn.findIndex(n=>termEq(n,s)); if(j>=0) mn.splice(j,1); else sourceTerms.push(s); }
        const ms=[...src.inner], resultTerms=[]; for(const n of newInnerIds){ const j=ms.findIndex(s=>termEq(s,n)); if(j>=0) ms.splice(j,1); else resultTerms.push(n); }
        const next={...P,[ev.side]:replaceById(P[ev.side],ev.groupId,{kind:'abs',coef:src.coef,inner:newInnerIds})};
        const hlA=sourceTerms.length?sourceTerms.map(t=>t.id):[ev.groupId];
        out.push({type:'highlight',termIds:hlA,group:true,caption:`Work out the like terms inside the bars.`});
        out.push({type:'evalInside',termId:ev.groupId,sourceIds:sourceTerms.map(t=>t.id),resultId:resultTerms.length?resultTerms[0].id:null,after:next,caption:`Inside the bars: ${innerText(src.inner)} = ${innerText(ev.newInner)}.`});
        return {steps:out,next}; } }

    { const ev=detectEvalInside(P,Q,'paren');
      if(ev){ const src=P[ev.side].find(t=>t.id===ev.groupId);
        const newInnerIds=assignIds(ev.newInner);
        const mn=[...newInnerIds], sourceTerms=[]; for(const s of src.inner){ const j=mn.findIndex(n=>termEq(n,s)); if(j>=0) mn.splice(j,1); else sourceTerms.push(s); }
        const ms=[...src.inner], resultTerms=[]; for(const n of newInnerIds){ const j=ms.findIndex(s=>termEq(s,n)); if(j>=0) ms.splice(j,1); else resultTerms.push(n); }
        const next={...P,[ev.side]:replaceById(P[ev.side],ev.groupId,{kind:'paren',coef:src.coef,inner:newInnerIds})};
        const hlP=sourceTerms.length?sourceTerms.map(t=>t.id):[ev.groupId];
        out.push({type:'highlight',termIds:hlP,group:true,caption:`Work out the like terms inside the brackets.`});
        out.push({type:'evalInside',termId:ev.groupId,sourceIds:sourceTerms.map(t=>t.id),resultId:resultTerms.length?resultTerms[0].id:null,after:next,caption:`Inside the brackets: ${innerText(src.inner)} = ${innerText(ev.newInner)}.`});
        return {steps:out,next}; } }

    { const mu=detectMultiply(P,Q);
      if(mu){ const src0=P[mu.side].find(t=>t.id===mu.id); const next={...P,[mu.side]:replaceById(P[mu.side],mu.id,mu.result)};
        out.push({type:'highlight',termIds:[mu.id],group:true,caption:`Multiply the numbers together.`});
        out.push({type:'multiply',termId:mu.id,after:next,caption:`Multiply: ${fmtTerm(src0)} becomes ${fmtTerm({...mu.result,id:mu.id})}.`});
        return {steps:out,next}; } }

    { const ef=detectEvalFrac(P,Q);
      if(ef){ const src0=P[ef.side].find(t=>t.id===ef.id); const next={...P,[ef.side]:replaceById(P[ef.side],ef.id,ef.result)};
        out.push({type:'highlight',termIds:[ef.id],group:true,caption:`Work out the division.`});
        out.push({type:'evalFrac',termId:ef.id,after:next,caption:`Divide: ${fmtTerm(src0)} becomes ${fmtTerm({...ef.result,id:ef.id})}.`});
        return {steps:out,next}; } }

    { const rp=detectRewritePower(P,Q);
      if(rp){ const src0=P[rp.side].find(t=>t.id===rp.id); const next={...P,[rp.side]:replaceById(P[rp.side],rp.id,rp.result)};
        const cap = rp.dir==='rewrite' ? `Rewrite ${fmtTerm(src0,{withSign:false})} as a square: ${fmtTerm({...rp.result,id:rp.id},{withSign:false})}.` : `Work out the power: ${fmtTerm(src0,{withSign:false})} = ${fmtTerm({...rp.result,id:rp.id},{withSign:false})}.`;
        out.push({type:'highlight',termIds:[rp.id],group:true,caption: rp.dir==='rewrite'?`This number is a perfect square.`:`Work out the power.`});
        out.push({type:(rp.dir==='rewrite'?'rewritePower':'evalPower'),termId:rp.id,after:next,caption:cap});
        return {steps:out,next}; } }

    { const rf=detectReorderFactors(P,Q);
      if(rf){ const next={...P,[rf.side]:replaceById(P[rf.side],rf.id,rf.result)};
        out.push({type:'highlight',termIds:[rf.id],group:true,caption:`The order of factors doesn't change the product.`});
        out.push({type:'reorderFactors',termId:rf.id,after:next,caption:`Swap the order of the brackets \\u2014 multiplication is commutative.`});
        return {steps:out,next}; } }

    { const zp=detectZeroProduct(P,Q);
      if(zp){ out.push({type:'highlight',termIds:[zp.productId],group:true,caption:`A product equals zero, so at least one factor must be zero.`});
        out.push({type:'zeroProduct',productId:zp.productId,after:Q,caption:`Set each factor equal to zero and read off the roots.`});
        return {steps:out,next:Q}; } }

    { const fc=detectFactor(P,Q);
      if(fc){ const resultTerm=assignIds([fc.result])[0]; const kept=P[fc.side].filter(t=>!fc.remIds.includes(t.id));
        const arr=kept.slice(); arr.splice(Math.min(fc.firstIdx,arr.length),0,resultTerm); const next={...P,[fc.side]:arr};
        out.push({type:'highlight',termIds:fc.remIds,group:true,caption: fc.result.factors.every(f=>f.kind==='paren')?`A difference of two squares: a\\u00b2 \\u2212 b\\u00b2 = (a \\u2212 b)(a + b).`:`Factor out the common factor.`});
        out.push({type:'factor',termIds:fc.remIds,after:next,caption: fc.result.factors.every(f=>f.kind==='paren')?`Factor the difference of squares into two brackets.`:`Write it as a product by taking out the common factor.`});
        return {steps:out,next}; } }

    { const ex=detectExpand(P,Q);
      if(ex){ const newTerms=ex.resultTerms.map(t=>({...t,id:newId()})); const kept=P[ex.side].filter(t=>t.id!==ex.id);
        const arr=kept.slice(); arr.splice(Math.min(ex.idx,arr.length),0,...newTerms); const next={...P,[ex.side]:arr};
        out.push({type:'highlight',termIds:[ex.id],group:true,caption:`Multiply the brackets out (every term times every term).`});
        out.push({type:'expand',termId:ex.id,after:next,caption:`Expand the product into a sum.`});
        return {steps:out,next}; } }

    { const fl=detectFlatten(P,Q);
      if(fl){ const parent=P[fl.side].find(t=>t.id===fl.parenId);
        const sub=parent.inner[fl.idx];
        const newInner=flattenSub(parent.inner, fl.idx).map(t=>({...t,id:t.id||newId()}));
        const newParent={...parent, inner:newInner};
        const next={...P,[fl.side]:replaceById(P[fl.side],fl.parenId,newParent)};
        out.push({type:'highlight',termIds:[fl.subId],group:true,caption:`The inner brackets just add \\u2014 they can be removed.`});
        out.push({type:'flatten',parenId:fl.parenId,subId:fl.subId,after:next,caption:`Drop the inner brackets.`});
        return {steps:out,next}; } }

    { const cd=detectCommonDenom(P,Q);
      if(cd){ out.push({type:'highlight',termIds:cd.fracIds,group:true,caption:`Give the fractions a common denominator.`});
        out.push({type:'commonDenom',fracIds:cd.fracIds,after:cd.cand,caption:`Rewrite the fractions over a common denominator.`});
        return {steps:out,next:cd.cand}; } }

    { const cf=detectCombineFractions(P,Q);
      if(cf){ out.push({type:'highlight',termIds:cf.sourceIds,group:true,caption:`Same denominator \u2014 put both numerators over one shared bar.`});
        out.push({type:'combineFractions',sourceIds:cf.sourceIds,resultId:cf.resultId,after:cf.cand,caption:`Write the numerators as a sum over the shared denominator.`});
        return {steps:out,next:cf.cand}; } }

    { const en=detectEvalNumerator(P,Q);
      if(en){ out.push({type:'evalNumerator',fracsumId:en.fracsumId,after:en.cand,caption:`Add the numerators.`});
        return {steps:out,next:en.cand}; } }

    { const rf=detectReduceFraction(P,Q);
      if(rf){ out.push({type:'reduceFraction',fracId:rf.fracId,after:rf.cand,caption:`Reduce the fraction.`});
        return {steps:out,next:rf.cand}; } }

    { const uw=detectUnwrapParen(P,Q);
      if(uw){ out.push({type:'unwrap',parenId:uw.parenId,after:uw.cand,caption:`Drop the brackets \\u2014 there's only one term left inside.`});
        return {steps:out,next:uw.cand}; } }

    { const es=detectExpandSquare(P,Q);
      if(es){
        out.push({type:'highlight',termIds:[es.id],group:true,caption:`Expand the square: (a+b)² = a² + 2ab + b².`});
        out.push({type:'expandSquare',termId:es.id,after:es.next,caption:`Multiply the bracket by itself.`});
        return {steps:out,next:es.next}; } }

    { const di=detectDistribute(P,Q);
      if(di){ const A=P[di.side].find(t=>t.id===di.parenId); const a=A.coef;
        const rest=P[di.side].filter(t=>t.id!==A.id);
        const distributedNums=A.inner.map(t=>({...t,coef:rmul(t.coef,a),id:t.id}));
        const finalSide=matchTerms(Q[di.side],[...rest,...distributedNums])||[...rest,...distributedNums];
        const finalState={...P,[di.side]:finalSide};
        const innerIds=A.inner.map(t=>t.id);
        if(req(rabs(a),RONE)){
          let cap,hl;
          if(req(a,RONE)){ cap=`Remove the brackets \u2014 with nothing multiplying them, the terms just come out: ${innerText(A.inner)}.`; hl=`We can take these terms out of the brackets.`; }
          else { cap=`The minus in front flips every sign inside the brackets: ${innerText(A.inner)} becomes ${innerText(distributedNums)}.`; hl=`Multiply everything inside the brackets by \u22121.`; }
          out.push({type:'highlight',termIds:[A.id],group:true,caption:hl});
          out.push({type:'distribute',parenId:A.id,distributedIds:innerIds,after:finalState,caption:cap});
        } else {
          const prods=A.inner.map(t=>({kind:'prod',id:t.id,a:a,b:t}));
          const prodById={}; prods.forEach(p=>prodById[p.id]=p);
          const prodSide=finalSide.map(t=>prodById[t.id]||t);
          const prodState={...P,[di.side]:prodSide};
          const pT=prodText(prods);
          out.push({type:'highlight',termIds:[A.id],group:true,caption:`We multiply every term inside the brackets by ${rstr(a)}.`});
          out.push({type:'distribute',parenId:A.id,distributedIds:innerIds,after:prodState,caption:`Multiply each term by ${rstr(a)}: ${innerText(A.inner)} is written as ${pT}.`});
          out.push({type:'evalProducts',prodIds:innerIds,after:finalState,caption:`Now work out each multiplication: ${pT} = ${innerText(distributedNums)}.`});
        }
        return {steps:out,next:finalState}; } }

    { const sw=detectSwap(P,Q);
      if(sw){ const next={left:matchTerms(Q.left,P.right),rel:Q.rel,right:matchTerms(Q.right,P.left)};
        const cap=P.rel==='='?'Swap the two sides \u2014 allowed because \u201c=\u201d works both ways.':`Swap the two sides \u2014 the inequality flips direction: ${relStr(P.rel)} becomes ${relStr(Q.rel)}.`;
        out.push({type:'swapSides',after:next,caption:cap}); return {steps:out,next}; } }

    { const ng=detectNegate(P,Q);
      if(ng){ const next={left:matchTerms(Q.left,negList(P.left)),rel:Q.rel,right:matchTerms(Q.right,negList(P.right))};
        const cap=P.rel==='='?'Multiply BOTH sides by \u22121 \u2014 every sign flips.':`Multiply BOTH sides by \u22121 \u2014 every sign flips, and the inequality flips: ${relStr(P.rel)} becomes ${relStr(Q.rel)}.`;
        out.push({type:'negateBoth',after:next,op:'\u00d7 (\u22121)',caption:cap}); return {steps:out,next}; } }

    { const sc=detectScale(P,Q);
      if(sc){ const k=sc.k; const next={left:matchTerms(Q.left,scaleList(P.left,k)),rel:Q.rel,right:matchTerms(Q.right,scaleList(P.right,k))};
        const inv=rdiv(RONE,k); const isDiv=risInt(inv)&&Math.abs(inv.n)>1; const op=isDiv?`\u00f7 ${rstr(rabs(inv))}`:`\u00d7 ${rstr(k)}`;
        let cap;
        if(P.rel==='='){ cap=isDiv?`Divide BOTH sides by ${rstr(rabs(inv))} \u2014 stays balanced.`:`Multiply BOTH sides by ${rstr(k)} \u2014 stays balanced.`; }
        else if(rnegq(k)){ cap=`${isDiv?'Divide':'Multiply'} BOTH sides by ${isDiv?rstr(rabs(inv)):rstr(k)} \u2014 it's negative, so the inequality flips: ${relStr(P.rel)} becomes ${relStr(Q.rel)}.`; }
        else { cap=`${isDiv?'Divide':'Multiply'} BOTH sides by ${isDiv?rstr(rabs(inv)):rstr(k)} \u2014 positive, so ${relStr(P.rel)} stays the same.`; }
        out.push({type:'scaleBoth',after:next,op,caption:cap}); return {steps:out,next}; } }

    { const mv=detectMove(P,Q);
      if(mv){ let working=P;
        for(let mIdx=0;mIdx<mv.moves.length;mIdx++){
          const {term,from,to}=mv.moves[mIdx];
          const keyed=working[from].find(t=>termEq(t,term));
          if(!keyed) throw new Error(`Internal: lost a term in ${label}.`);
          const isLast=mIdx===mv.moves.length-1;
          const afterFly={ left: from==='left'?working.left.filter(t=>t.id!==keyed.id):to==='left'?[...working.left,{...keyed}]:working.left,
            right: from==='right'?working.right.filter(t=>t.id!==keyed.id):to==='right'?[...working.right,{...keyed}]:working.right, rel:working.rel };
          let afterFlip;
          if(isLast){ const flipped={...keyed,coef:rneg(keyed.coef)};
            const poolL=afterFly.left.map(t=>t.id===keyed.id?flipped:t); const poolR=afterFly.right.map(t=>t.id===keyed.id?flipped:t);
            const mL=matchTerms(Q.left,poolL),mR=matchTerms(Q.right,poolR);
            afterFlip=(mL&&mR)?{left:mL,rel:Q.rel,right:mR}:{left:poolL,rel:Q.rel,right:poolR};
          } else { afterFlip={left:afterFly.left.map(t=>t.id===keyed.id?{...t,coef:rneg(t.coef)}:t),right:afterFly.right.map(t=>t.id===keyed.id?{...t,coef:rneg(t.coef)}:t),rel:working.rel}; }
          const name=fmtTerm(keyed,{withSign:false});
          out.push({type:'highlight',termIds:[keyed.id],caption:`Let's move ${name} to the other side.`});
          out.push({type:'move',termId:keyed.id,after:afterFly,caption:`${name} hops over the \u201c${relStr(P.rel)}\u201d to the ${to} side\u2026`});
          out.push({type:'flipSign',termId:keyed.id,after:afterFlip,caption:`\u2026crossing flips its sign: ${fmtTerm(keyed)} becomes ${fmtTerm({...keyed,coef:rneg(keyed.coef)})}.`});
          working=afterFlip;
        }
        return {steps:out,next:working}; } }

    { const cb=detectCombine(P,Q);
      if(cb){ let working=P;
        for(const g of cb.groups){
          const pool=[...working[g.side]]; const keyedSources=[];
          for(const s of g.sources){ const idx=pool.findIndex(t=>termEq(t,s)); keyedSources.push(pool[idx]); pool.splice(idx,1); }
          if(g.cancel){
            const dying=keyedSources.map(t=>t.id);
            const newSide=working[g.side].filter(t=>!dying.includes(t.id));
            const nx={...working,[g.side]:newSide};
            const names=keyedSources.map(t=>fmtTerm(t)).join(' and ');
            out.push({type:'highlight',termIds:dying,group:true,caption:`${names} cancel each other out.`});
            out.push({type:'cancel',sourceIds:dying,after:nx,caption:`${names} add up to zero, so they disappear.`});
            working=nx; continue;
          }
          const survivor=keyedSources[0];
          const fused={...g.result,id:survivor.id,inner:g.result.kind==='abs'?assignIds(g.result.inner):undefined};
          if(fused.kind==='num') delete fused.inner;
          const dying=keyedSources.slice(1).map(t=>t.id);
          const newSide=working[g.side].filter(t=>!dying.includes(t.id)).map(t=>t.id===survivor.id?fused:t);
          const nx={...working,[g.side]:newSide};
          const names=keyedSources.map(t=>fmtTerm(t)).join(' and ');
          out.push({type:'highlight',termIds:keyedSources.map(t=>t.id),group:true,caption:`${names} are like terms \u2014 put them together.`});
          out.push({type:'merge',sourceIds:keyedSources.map(t=>t.id),survivorId:survivor.id,after:nx,caption:`${names} combine into ${fmtTerm(fused)}.`});
          working=nx;
        }
        return {steps:out,next:working}; } }

    // not a single recognized op — diagnose equivalence
    const E=(st)=>{ const l=normalForm(st.left); const r=st.rel===null?{}:normalForm(st.right); const o={...l}; for(const k of Object.keys(r)) o[k]=radd(o[k]||RZERO,rneg(r[k])); for(const k of Object.keys(o)) if(rzero(o[k])) delete o[k]; return o; };
    const a=E(P), b=E(Q);
    const keys=[...new Set([...Object.keys(a),...Object.keys(b)])];
    const av=keys.map(k=>a[k]||RZERO), bv=keys.map(k=>b[k]||RZERO);
    let kk=null; const ri=av.findIndex(v=>!rzero(v));
    if(ri>=0 && !rzero(bv[ri])){ const cand=rdiv(bv[ri],av[ri]); if(av.every((v,idx)=>req(rmul(v,cand),bv[idx]))) kk=cand; }
    if(P.rel===null){
      if(kk && req(kk,RONE)) return {multiOp:true};
      throw new Error(`Between ${label}: these are NOT equal \u2014 check the math. ("${pStr}" vs "${qStr}")`);
    }
    if(!kk) throw new Error(`Between ${label}: these are NOT equivalent \u2014 check the math. ("${pStr}" vs "${qStr}")`);
    const requiredRel=rnegq(kk)?flipRel(P.rel):P.rel;
    if(Q.rel!==requiredRel){
      if(rnegq(kk)) throw new Error(`Between ${label}: when you multiply or divide by a negative number, the inequality must flip direction (${relStr(P.rel)} should become ${relStr(flipRel(P.rel))}).`);
      throw new Error(`Between ${label}: the inequality direction changed but shouldn't have.`);
    }
    return {multiOp:true};
  }

  for(let i=1;i<raw.length;i++){
    const Q=raw[i];
    const label=`state ${i} \u2192 state ${i+1}`;
    const pStr=stateStrs[i-1].trim(), qStr=stateStrs[i].trim();
    if(relEqStates(cur,Q)) continue; // exact duplicate line
    const res=buildPair(cur,Q,label,pStr,qStr);
    if(res.multiOp){
      const path=bridge(cur,Q);
      if(!path) throw new Error(`Between ${label}: more than one step happened at once, and I couldn't break it into standard steps automatically. Add an intermediate state.`);
      for(const mid of [...path, Q]){
        if(relEqStates(cur,mid)) continue;
        const r=buildPair(cur,mid,label,pStr,qStr);
        if(r.multiOp) throw new Error(`Between ${label}: couldn't fully break this into single steps automatically. Add an intermediate state.`);
        for(const s of r.steps) steps.push(s);
        cur=ensureIds(r.next);
      }
    } else {
      for(const s of res.steps) steps.push(s);
      cur=ensureIds(res.next);
    }
  }
  steps.push({type:'celebrate', caption:`Solved! ${stateStrs[stateStrs.length-1].trim()} \u2714`});
  return {initial, steps};
}
