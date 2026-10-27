global.window=global;const store={};global.localStorage={getItem:k=>store[k]===undefined?null:store[k],setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
['data','stadium','sim','cards','dev','rating','crests','season','league','legacy'].forEach(f=>require(__dirname+'/../js/'+f+'.js'));
const SN=GI.season,L=GI.league;
let S=SN.create({user:5,weeks:12,qMin:5,diff:'pro'});
const snap=()=>{const a=[];S.rosters.forEach(r=>r.stars.forEach(c=>a.push(c.rating)));const m=a.reduce((x,y)=>x+y,0)/a.length;return {m:m.toFixed(2),n85:a.filter(x=>x>=85).length,n90:a.filter(x=>x>=90).length,top:Math.max(...a)}};
for(let y=0;y<7;y++){
  if(S.phase==='draft'){SN.draftAuto(S);console.log('after draft',snap());SN.finishDraft(S);console.log('after finish',snap());}
  console.log('Y'+S.year,'pre-camp',snap());
  SN.runCamp(S,'offense',false); console.log(' after camp',snap());
  let g=0; while((S.phase==='regular')&&g++<40){SN.finishWeek(S,null);} console.log(' after regular',snap());
  while((S.phase==='playoffs')&&g++<60){SN.finishWeek(S,null);} 
  console.log(' offseason',snap());
  L.runFA(S); (S.expiring||[]).slice().forEach(id=>SN.resign(S,id,2)); SN.advanceToDraft(S);
}
