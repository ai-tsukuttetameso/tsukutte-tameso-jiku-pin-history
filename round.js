'use strict';
window.HistoryRound=(()=>{
  const LIMIT=60000,HINT_AT=45000,REVEALS=[10000,20000,35000];
  const elapsed=(started,now)=>Math.max(0,Math.min(LIMIT,now-started));
  function state(started,now){const ms=elapsed(started,now);return {elapsed:ms,remaining:Math.ceil((LIMIT-ms)/1000),phase:REVEALS.filter(at=>ms>=at).length,hint:ms>=HINT_AT,expired:ms>=LIMIT};}
  function score(km,ms){if(km===null)return {distancePoints:0,timePoints:0,total:0};const quality=Math.exp(-Math.max(0,km-10)/250),distancePoints=Math.round(800*quality),timePoints=Math.round(200*quality*(1-Math.max(0,Math.min(LIMIT,ms))/LIMIT));return {distancePoints,timePoints,total:distancePoints+timePoints};}
  function chunks(text){const chars=Array.from(text),n=chars.length;const ends=[];let count=0;for(const part of new Intl.Segmenter('ja',{granularity:'word'}).segment(text)){count+=Array.from(part.segment).length;ends.push(count);}
    const cut=(target,min,max)=>{const candidates=ends.filter(i=>i>=min&&i<=max);return candidates.reduce((best,i)=>Math.abs(i-target)<Math.abs(best-target)?i:best,Math.round(target));};
    const a=cut(n/3,Math.ceil(n*.2),Math.floor(n*.45)),b=cut(n*2/3,Math.ceil(n*.55),Math.floor(n*.8));return [chars.slice(0,a).join(''),chars.slice(a,b).join(''),chars.slice(b).join('')];}
  return {LIMIT,HINT_AT,REVEALS,state,score,chunks};
})();
