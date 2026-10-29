'use strict';
// Shared pure rules for selection, storage migration and the browser UI.
window.HistoryLearning = (() => {
  const eras=['飛鳥','奈良','平安','鎌倉','室町・南北朝','戦国・安土桃山','江戸','幕末','明治','大正・昭和'];
  const defaults=()=>({eras:[...eras],from:null,to:null,exclude:true,km:50,count:5});
  function questionCount(value){const n=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value;return Number.isInteger(n)&&n>=1&&n<=100?n:5;}
  function normalize(s={}){s=s&&typeof s==='object'?s:{};return {eras:Array.isArray(s.eras)?eras.filter(e=>s.eras.includes(e)):[...eras],from:Number.isInteger(s.from)&&s.from>=1&&s.from<=2100?s.from:null,to:Number.isInteger(s.to)&&s.to>=1&&s.to<=2100?s.to:null,exclude:s.exclude!==false,km:[10,25,50,100].includes(s.km)?s.km:50,count:questionCount(s.count)};}
  function pool(questions,s,progress){const matching=questions.filter(q=>s.eras.includes(q.era)&&(s.from===null||q.date>=s.from)&&(s.to===null||q.date<=s.to));const mastered=matching.filter(q=>Number.isFinite(progress[q.id]?.bestKm)&&progress[q.id].bestKm<=s.km);const known=new Set(mastered.map(q=>q.id));return {matching,mastered,eligible:s.exclude?matching.filter(q=>!known.has(q.id)):matching};}
  function select(questions,s,progress,seed){let n=seed>>>0;const ids=pool(questions,s,progress).eligible.map(q=>q.id);for(let i=ids.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}return ids.sort((a,b)=>(progress[a]?.attempts||0)-(progress[b]?.attempts||0)).slice(0,normalize(s).count);}
  function record(progress,id,km,time=Date.now()){if(!Number.isFinite(km)||km<0)return;const old=progress[id];progress[id]={bestKm:Math.min(old?.bestKm??Infinity,km),attempts:(old?.attempts||0)+1,lastKm:km,lastAt:time};}
  function sanitize(questions,progress={}){const out={};questions.forEach(q=>{const a=progress[q.id];if(a&&Number.isFinite(a.bestKm)&&a.bestKm>=0&&Number.isInteger(a.attempts)&&a.attempts>0)out[q.id]={bestKm:a.bestKm,attempts:a.attempts,lastKm:Number.isFinite(a.lastKm)?a.lastKm:a.bestKm,lastAt:Number.isFinite(a.lastAt)?a.lastAt:0};});return out;}
  return {eras,defaults,normalize,pool,select,record,sanitize};
})();
