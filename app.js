'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const Q=window.HISTORY_QUESTIONS,KEY='jiku-pin-history-v1';
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
const L=window.HistoryLearning,T=window.HistoryRound;
const dailySeed=Array.from(today).reduce((s,c)=>Math.imul(s,31)+c.charCodeAt(0),17)>>>0;
let settings=L.defaults(),progress={},best=0,legacyBest=0,bests={},game;
function newState(ids,mode='practice'){return {v:3,day:today,ids,mode,index:0,stage:ids.length?'guess':'empty',answers:[],guess:null,hint:false,roundStartedAt:null,requestedCount:L.normalize(settings).count};}
function validPosition(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=27&&p.lat<=49&&p.lon>=124&&p.lon<=151;}
function validGame(s){if(!s||![1,2,3].includes(s.v)||!Array.isArray(s.ids)||s.ids.length>Q.length||new Set(s.ids).size!==s.ids.length||!s.ids.every(id=>Q.some(q=>q.id===id))||!Array.isArray(s.answers))return false;
 if(!s.ids.length)return s.stage==='empty'&&s.answers.length===0;
 if(!['guess','reveal','finish'].includes(s.stage)||!Number.isInteger(s.index)||s.index<0||s.index>=s.ids.length||!(s.day===today||s.mode==='practice'))return false;
 const count=s.stage==='finish'?s.ids.length:s.index+(s.stage==='reveal'?1:0);
 return s.answers.length===count&&s.answers.every((a,i)=>a.id===s.ids[i]&&((validPosition(a.guess)&&Number.isFinite(a.km)&&a.km>=0)||(a.timedOut===true&&a.guess===null&&a.km===null))&&Number.isFinite(a.points)&&a.points>=0&&a.points<=1000)&&(!s.guess||validPosition(s.guess));
}
try{const stored=JSON.parse(localStorage.getItem(KEY));if(stored){const previousBest=Number.isFinite(stored.best)?Math.max(0,Math.min(5000,stored.best)):0;best=stored.version===3?previousBest:0;legacyBest=stored.version===3?(Number.isFinite(stored.legacyBest)?stored.legacyBest:0):previousBest;bests={5:best};if(stored.version===3)Object.entries(stored.bests||{}).forEach(([n,value])=>{const count=Number(n);if(Number.isInteger(count)&&count>=1&&count<=Q.length&&Number.isFinite(value)&&value>=0&&value<=count*1000)bests[count]=value;});best=bests[5]||0;settings=L.normalize(stored.settings);progress=L.sanitize(Q,stored.progress);if(![2,3].includes(stored.version)&&Array.isArray(stored.game?.answers))stored.game.answers.forEach(a=>{if(Q.some(q=>q.id===a.id))L.record(progress,a.id,a.km);});if(validGame(stored.game)){game={...stored.game,v:3};game.roundStartedAt=stored.game.v===3&&Number.isFinite(stored.game.roundStartedAt)?Math.min(Date.now(),stored.game.roundStartedAt):null;if(stored.game.v!==3)game.hint=false;}}}catch{}
if(!game)game=newState(L.select(Q,settings,progress,dailySeed),'daily');
const view={scale:1,tx:0,ty:0};let ready=false,drag=null,toastTimer;
const map=$('map'),scene=$('map-scene');
function save(){try{localStorage.setItem(KEY,JSON.stringify({version:3,best,legacyBest,bests,settings,progress,game}));}catch{toast('このブラウザでは記録を保存できません。');}}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function current(){return Q.find(q=>q.id===game.ids[game.index]);}
function merc(lat){return Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));}
const extent={minLon:128,maxLon:147,minLat:30,maxLat:46.5};
const SCALE=Math.min(680/((extent.maxLon-extent.minLon)*Math.PI/180),560/(merc(extent.maxLat)-merc(extent.minLat)));
const centerLon=(extent.minLon+extent.maxLon)/2,centerY=(merc(extent.maxLat)+merc(extent.minLat))/2;
function project(lon,lat){return [380+(lon-centerLon)*Math.PI/180*SCALE,310+(centerY-merc(lat))*SCALE];}
function unproject(x,y){return {lon:centerLon+(x-380)/SCALE*180/Math.PI,lat:(2*Math.atan(Math.exp(centerY-(y-310)/SCALE))-Math.PI/2)*180/Math.PI};}
function distance(a,b){const rad=x=>x*Math.PI/180,dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon);const n=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 6371*2*Math.atan2(Math.sqrt(Math.min(1,n)),Math.sqrt(Math.max(0,1-n)));}
function answering(){return game.stage==='guess'&&Number.isFinite(game.roundStartedAt);}
function timing(){return T.state(game.roundStartedAt,Date.now());}
function renderClock(){const active=answering();if(!active)return;const clock=timing();
 if(clock.expired){finishRound(true);return;}
 $('time-left').replaceChildren(document.createTextNode(String(clock.remaining)),Object.assign(document.createElement('small'),{textContent:'秒'}));
 $('time-fill').style.width=(100*(T.LIMIT-clock.elapsed)/T.LIMIT)+'%';$('time-track').setAttribute('aria-valuenow',clock.remaining);$('question-card').classList.toggle('urgent',clock.remaining<=15);
 const label=clock.hint?'ヒント解禁':`説明 ${clock.phase} / 3`;
 if($('clue-status').textContent!==label)$('clue-status').textContent=label;
 const copy=clock.phase?T.chunks(current().question).slice(0,clock.phase).join(''):'';
 if($('question-copy').textContent!==copy)$('question-copy').textContent=copy;
 $('question-copy').hidden=!copy;
 $('next-clue').textContent=clock.phase<3?`次の説明まで あと${Math.ceil((T.REVEALS[clock.phase]-clock.elapsed)/1000)}秒`:clock.hint?'説明がすべて届きました。ヒントも使えます。':'説明がすべて届きました。45秒経過でヒント解禁。';
 $('hint-button').disabled=!clock.hint;$('hint-button').textContent=clock.hint?(game.hint?'✧ ヒントをしまう':'✧ 旅のヒントを見る'):`✧ ヒント解禁まで あと${Math.ceil((T.HINT_AT-clock.elapsed)/1000)}秒`;
 $('hint-copy').textContent=clock.hint&&game.hint?current().hint:'';$('hint-copy').hidden=!(clock.hint&&game.hint);
}
function startRound(){if(game.stage!=='guess'||answering()||!ready)return;game.roundStartedAt=Date.now();game.hint=false;save();render();focusContent('question-card');}
function finishRound(timedOut=false){if(!answering()||(!ready&&!timedOut))return;const clock=timing();timedOut=timedOut||clock.expired;if(!timedOut&&!game.guess)return;
 const q=current(),guess=game.guess?{...game.guess}:null,km=guess?distance(guess,q):null,ms=timedOut?T.LIMIT:clock.elapsed,score=T.score(km,ms);
 game.answers.push({id:q.id,guess,km,points:score.total,...score,elapsedMs:ms,timedOut,rules:3});if(km!==null)L.record(progress,q.id,km);
 game.stage='reveal';resetView();save();render();focusContent('answer-card');if(timedOut)toast(guess?'時間切れ。置いてあるピンで回答しました。':'時間切れ。ピンがないため0点です。');
}

function node(name,attrs={},text){const n=document.createElementNS(NS,name);Object.entries(attrs).forEach(([key,value])=>n.setAttribute(key,String(value)));if(text!==undefined)n.textContent=text;return n;}
function applyView(){const s=view.scale;view.tx=Math.min(0,Math.max(760*(1-s),view.tx));view.ty=Math.min(0,Math.max(620*(1-s),view.ty));scene.setAttribute('transform',`translate(${view.tx} ${view.ty}) scale(${s})`);$('zoom-in').disabled=s>=3.5;$('zoom-out').disabled=s<=1;}
function resetView(){view.scale=1;view.tx=0;view.ty=0;applyView();}
function zoom(factor){const old=view.scale,next=Math.max(1,Math.min(3.5,old*factor)),cx=(380-view.tx)/old,cy=(310-view.ty)/old;view.scale=next;view.tx=380-cx*next;view.ty=310-cy*next;applyView();drawPins();}
function drawPins(){const layer=$('pins');layer.replaceChildren();const finished=game.stage==='finish';const result=game.stage==='reveal'?game.answers[game.index]:null;
  const dot=(position,type,label)=>{const [x,y]=project(position.lon,position.lat),s=view.scale;layer.append(node('circle',{cx:x,cy:y,r:8/s,class:type==='guess'?'guess-dot':'correct-dot'}));if(label)layer.append(node('text',{x:x+12/s,y:y-13/s,class:'pin-label','font-size':11/s},label));};
  if(finished){game.answers.forEach((a,i)=>{const q=Q.find(q=>q.id===a.id);const p=project(q.lon,q.lat);dot(q,'correct');layer.append(node('text',{x:p[0]+11/view.scale,y:p[1]-9/view.scale,class:'pin-label','font-size':11/view.scale},String(i+1)));});return;}
  if(result){const q=current(),b=project(q.lon,q.lat);if(result.guess){const a=project(result.guess.lon,result.guess.lat);layer.append(node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'route-line'}));dot(result.guess,'guess','予想');}dot(q,'correct',q.place);}
  else if(game.guess)dot(game.guess,'guess','ここだと思う！');
}
function render(){const q=current(),total=game.answers.reduce((s,a)=>s+a.points,0),count=game.ids.length,empty=game.stage==='empty';
  $('round-mode').textContent=empty?'次の旅を選ぼう':game.mode==='daily'?`今日の${count}問`:`歴史の旅 · ${count}問`;
  $('round-label').textContent=empty?'00 / 00':`${String(game.stage==='finish'?count:game.index+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`;
  $('steps').replaceChildren();$('steps').classList.toggle('compact',count>15);$('steps').setAttribute('aria-label',`全${count}問中${game.stage==='finish'?count:Math.min(game.index+1,count)}問目`);if(count>15){const bar=document.createElement('span');bar.className='long-step';bar.style.width=((game.stage==='finish'?count:game.index+1)/count*100)+'%';$('steps').append(bar);}else for(let i=0;i<count;i++)$('steps').append(nodeForStep(i));$('trip-count').textContent=String(count).padStart(2,'0');
  ['question','answer','finish','empty'].forEach((name,i)=>$(name+'-card').hidden=game.stage!==['guess','reveal','finish','empty'][i]);
  $('submit').hidden=game.stage!=='guess';$('next').hidden=game.stage!=='reveal';$('new-trip').hidden=game.stage!=='finish';$('total-score').textContent=total.toLocaleString('ja-JP');
  const active=answering();$('ready-card').hidden=game.stage!=='guess'||active;$('question-card').hidden=!active;$('start-round').disabled=!ready;$('start-round').textContent=ready?'この問題を始める →':'地図を準備しています…';$('submit').hidden=!active;
  if(q){$('era').textContent=q.era;$('year').textContent=q.year;$('q-icon').textContent=q.icon;$('question-title').textContent=q.title;$('question-copy').textContent='';$('hint-copy').textContent='';$('hint-copy').hidden=true;}
  const status=$('selection-label');status.classList.toggle('selected',!!game.guess);status.replaceChildren();const dot=document.createElement('span');dot.className='status-dot';status.append(dot,document.createTextNode(empty?'出題条件を変えると、また旅に出られます。':game.stage==='guess'&&!active?'開始ボタンで、問題と時計が動き出します。':game.stage==='finish'?`${count}つの歴史の舞台をたどりました。`:game.stage==='reveal'?'オレンジが予想、緑が正解の場所です。':game.guess?`予想のピン：北緯${game.guess.lat.toFixed(1)}° / 東経${game.guess.lon.toFixed(1)}°`:'地図をタップして、予想のピンを置こう。'));
  $('submit').disabled=!game.guess||!ready||!active;$('action-note').textContent=empty?'時代・年代・スキップ条件を見直してみよう。':game.stage==='finish'?'次の旅では、今の出題条件と学習記録を使います。':count<(game.requestedCount||count)?`希望${game.requestedCount}問に対し対象が${count}問のため、今回は${count}問の旅です。`:game.stage==='reveal'?'出来事の場所も、ひとつずつ記憶に。':active?'60秒で自動回答。近く、早く決めるほど高得点。':'1問60秒。準備ができたら始めましょう。';
  if(game.stage==='reveal'){const a=game.answers[game.index];$('answer-place').textContent=q.place;$('answer-area').textContent=q.area;$('distance').textContent=a.km===null?'未回答':(a.km<1?a.km.toFixed(1):Math.round(a.km).toLocaleString('ja-JP'))+' km';$('round-score').textContent=a.points.toLocaleString('ja-JP')+' pt';$('score-breakdown').textContent=a.rules===3?`距離 ${a.distancePoints}点 ＋ 速さ ${a.timePoints}点 · ${(a.elapsedMs/1000).toFixed(1)}秒${a.timedOut?'（時間切れ・自動回答）':''}`:'旧ルールの回答';$('answer-comment').textContent=a.km===null?'時間切れ。次はピンを置いてみましょう。':a.km<=10?'ぴたり。歴史の舞台にたどり着きました。':a.km<=100?'すぐ近くまで、たどり着きました。':a.km<=350?'惜しい！ 地域の記憶を、もうひと押し。':'新しい場所を、ひとつ覚えましたね。';$('explanation').textContent=q.explanation;$('source').textContent=q.source+' ↗';$('source').href=q.url;$('next').querySelector('span').textContent=game.index===count-1?'旅の結果を見る':'次の場所へ旅する';}
  if(game.stage==='finish')renderFinish(total);
  renderLearning();drawPins();if(active)renderClock();
}
function nodeForStep(i){const n=document.createElement('span');n.className='step'+(game.stage==='finish'||i<game.index?' done':i===game.index?' current':'');n.setAttribute('aria-label',`第${i+1}問${i<game.index?' 回答済み':i===game.index?' 現在の問題':''}`);return n;}
function renderFinish(total){$('finish-copy').textContent=`${game.ids.length}つの出来事が、地図の上でつながりました。`;$('max-score').textContent=`/ ${(game.ids.length*1000).toLocaleString('ja-JP')} pt`;$('final-score').textContent=total.toLocaleString('ja-JP');$('final-title').textContent=total>=game.ids.length*900?'称号：歴史の道しるべ':total>=game.ids.length*600?'称号：時空の旅人':total>=game.ids.length*300?'称号：歴史の探検家':'称号：はじめての歴史散歩';$('best-score').textContent=`時間制・${game.ids.length}問の最高：`+(bests[game.ids.length]||0).toLocaleString('ja-JP')+' pt'+(game.ids.length===5&&legacyBest?'（旧ルール：'+legacyBest.toLocaleString('ja-JP')+' pt）':'');$('summary-list').replaceChildren();game.answers.forEach((a,i)=>{const q=Q.find(q=>q.id===a.id),row=document.createElement('div');row.className='summary-row';const label=document.createElement('span');label.textContent=`${i+1}. ${q.place}`;const value=document.createElement('b');value.textContent=a.points.toLocaleString('ja-JP')+' pt';row.append(label,value);$('summary-list').append(row);});}
function choose(position){if(!answering()||!ready)return;if(timing().expired){finishRound(true);return;}if(position.lon<124||position.lon>151||position.lat<27||position.lat>49){toast('日本の見える範囲にピンを置いてみよう。');return;}game.guess=position;save();render();}
function mapPoint(e){const p=map.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(map.getScreenCTM().inverse());}
map.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=mapPoint(e);drag={id:e.pointerId,start:p,last:p,moved:false};map.setPointerCapture(e.pointerId);});
map.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=mapPoint(e);if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>6)drag.moved=true;if(drag.moved){view.tx+=p.x-drag.last.x;view.ty+=p.y-drag.last.y;applyView();$('map-frame').classList.add('dragging');}drag.last=p;});
map.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const p=mapPoint(e);if(!drag.moved)choose(unproject((p.x-view.tx)/view.scale,(p.y-view.ty)/view.scale));drag=null;$('map-frame').classList.remove('dragging');if(map.hasPointerCapture(e.pointerId))map.releasePointerCapture(e.pointerId);});
map.addEventListener('pointercancel',()=>{drag=null;$('map-frame').classList.remove('dragging');});
map.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)||game.stage!=='guess')return;e.preventDefault();const p={...(game.guess||{lat:36.5,lon:137.5})},step=e.shiftKey?.7:.15;p.lat+=e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0;p.lon+=e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0;choose(p);});
$('zoom-in').addEventListener('click',()=>zoom(1.5));$('zoom-out').addEventListener('click',()=>zoom(1/1.5));$('map-reset').addEventListener('click',()=>{resetView();drawPins();});
$('start-round').addEventListener('click',startRound);
$('hint-button').addEventListener('click',()=>{if(!answering())return;const clock=timing();if(clock.expired){finishRound(true);return;}if(!clock.hint)return;game.hint=!game.hint;save();renderClock();});
$('submit').addEventListener('click',()=>finishRound());
function focusContent(id){if(innerWidth<=800)$(id).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
$('next').addEventListener('click',()=>{if(game.stage!=='reveal')return;if(game.index===game.ids.length-1){game.stage='finish';if(game.answers.every(a=>a.rules===3)){const n=game.ids.length,total=game.answers.reduce((s,a)=>s+a.points,0);bests[n]=Math.max(bests[n]||0,total);best=bests[5]||0;}}else{game.index++;game.stage='guess';game.guess=null;game.hint=false;game.roundStartedAt=Date.now();}resetView();save();render();focusContent(game.stage==='finish'?'finish-card':'question-card');});
function resetTrip(ids,mode){game=newState(ids,mode);resetView();save();render();focusContent('ready-card');}
$('new-trip').addEventListener('click',()=>startSelectedTrip());
$('restart-button').addEventListener('click',()=>{if(game.answers.length||game.guess||answering()){$('restart-dialog').showModal();}else resetTrip(game.ids,game.mode);});
$('confirm-restart').addEventListener('click',()=>{$('restart-dialog').close();resetTrip(game.ids,game.mode);});$('cancel-restart').addEventListener('click',()=>$('restart-dialog').close());
$('how-button').addEventListener('click',()=>$('how-dialog').showModal());$('close-how').addEventListener('click',()=>$('how-dialog').close());$('start-how').addEventListener('click',()=>$('how-dialog').close());
$('share-button').addEventListener('click',async()=>{const total=game.answers.reduce((s,a)=>s+a.points,0),s=`時空ピン｜歴史の旅\n${total.toLocaleString('ja-JP')} / ${(game.ids.length*1000).toLocaleString('ja-JP')} pt\n${game.answers.map(a=>a.points>=900?'🟩':a.points>=500?'🟨':'🟧').join('')}\n歴史を、地図でたどろう。`;try{await navigator.clipboard.writeText(s);toast('結果をコピーしました。');}catch{toast('このブラウザではコピーできませんでした。');}});
async function loadMap(){try{const r=await fetch('assets/japan.json');if(!r.ok)throw new Error('Map unavailable');const feature=await r.json();const polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];polygons.forEach(polygon=>{const d=polygon.map(ring=>ring.map(([lon,lat],i)=>{const [x,y]=project(lon,lat);return(i?'L':'M')+x.toFixed(2)+','+y.toFixed(2);}).join('')+'Z').join('');$('land').append(node('path',{d,class:'land-path','fill-rule':'evenodd'}));});
  for(let lon=130;lon<=145;lon+=5){const a=project(lon,30),b=project(lon,46.5);$('graticule').append(node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'grid-line'}));$('graticule').append(node('text',{x:b[0]+5,y:21,class:'grid-label'},lon+'°E'));}
  for(let lat=30;lat<=45;lat+=5){const a=project(128,lat),b=project(147,lat);$('graticule').append(node('line',{x1:0,y1:a[1],x2:760,y2:b[1],class:'grid-line'}));$('graticule').append(node('text',{x:17,y:a[1]-5,class:'grid-label'},lat+'°N'));}
  [['北海道',143.0,43.6],['東北',141.1,39.3],['関東',140.4,36.4],['中部',137.7,36.6],['近畿',134.6,34.8],['中国',132.0,35.1],['四国',133.7,33.6],['九州',130.1,32.6]].forEach(([name,lon,lat])=>{const p=project(lon,lat);$('region-labels').append(node('text',{x:p[0],y:p[1],class:'region-label','text-anchor':'middle'},name));});ready=true;$('map-loading').hidden=true;if(game.stage==='guess'&&game.index>0&&!answering())startRound();else render();}
  catch{$('map-loading').textContent='地図を読み込めませんでした。ページを再読み込みしてください。';}}
function renderLearning(){const p=L.pool(Q,settings,progress),era=settings.eras.length===L.eras.length?'全時代':settings.eras.length?settings.eras.join('・'):'時代未選択',range=settings.from!==null||settings.to!==null?` · ${settings.from??'最初'}〜${settings.to??'最後'}年`:'';
 $('settings-summary').textContent=`${L.normalize(settings).count}問の旅 · `+era+range;
 $('learning-summary').textContent=`全${Q.length}問 · 条件内${p.matching.length}問 · ${settings.km}km以内で回答済み${p.mastered.length}問 · 次の出題対象${p.eligible.length}問`;
 $('empty-message').textContent=p.matching.length===0?'選んだ時代・年代に合う問題がありません。条件を広げてみましょう。':`この条件の${p.matching.length}問は、すべて${settings.km}km以内で回答済みです。別の時代を選ぶか、スキップをオフにすると復習できます。`;
}
function startSelectedTrip(){settings=L.normalize(settings);const ids=L.select(Q,settings,progress,crypto.getRandomValues(new Uint32Array(1))[0]);resetTrip(ids,'practice');if(ids.length&&ids.length<settings.count)toast(`希望${settings.count}問に対し対象が${ids.length}問のため、${ids.length}問で出題します。`);}
L.eras.forEach(era=>{const label=document.createElement('label');label.className='era-option';const input=document.createElement('input');input.type='checkbox';input.value=era;input.name='era';const span=document.createElement('span');span.textContent=era;label.append(input,span);$('era-options').append(label);});
function readDraft(){const from=$('year-from').value,to=$('year-to').value;return {eras:[...document.querySelectorAll('[name="era"]:checked')].map(n=>n.value),from:from===''?null:Number(from),to:to===''?null:Number(to),exclude:$('exclude-mastered').checked,km:Number($('mastery-km').value),count:document.querySelector('[name="question-count"]:checked').value==='custom'?Number($('custom-count').value):Number(document.querySelector('[name="question-count"]:checked').value)};}
function draftError(s){if(!Number.isInteger(s.count)||s.count<1||s.count>100)return '問題数は1〜100の整数で入力してください。';if([s.from,s.to].some(v=>v!==null&&(!Number.isInteger(v)||v<1||v>2100)))return '年代は1〜2100の整数で入力してください。';return s.from!==null&&s.to!==null&&s.from>s.to?'開始年は、終了年以前にしてください。':'';}
function previewSettings(){const custom=document.querySelector('[name="question-count"]:checked').value==='custom';$('custom-count-label').hidden=!custom;$('custom-count').disabled=!custom;$('custom-count').required=custom;const s=readDraft(),error=draftError(s);$('settings-error').textContent=error;$('settings-error').hidden=!error;$('apply-settings').disabled=!!error;if(error){$('pool-preview').textContent='問題数と年代の入力を確認してください。';return;}const p=L.pool(Q,s,progress);$('pool-preview').textContent=`条件内 ${p.matching.length}問 ／ ${s.km}km以内で回答済み ${p.mastered.length}問 → 出題対象 ${p.eligible.length}問`+(p.eligible.length?` · 今回は${Math.min(s.count,p.eligible.length)}問`:' · 条件を広げると出題できます。');}
function openSettings(){document.querySelectorAll('[name="question-count"]').forEach(n=>n.checked=n.value===([5,15,30].includes(settings.count)?String(settings.count):'custom'));$('custom-count').value=settings.count;document.querySelectorAll('[name="era"]').forEach(n=>n.checked=settings.eras.includes(n.value));$('year-from').value=settings.from??'';$('year-to').value=settings.to??'';$('exclude-mastered').checked=settings.exclude;$('mastery-km').value=settings.km;previewSettings();$('settings-dialog').showModal();}
$('settings-button').addEventListener('click',openSettings);$('empty-settings').addEventListener('click',openSettings);$('close-settings').addEventListener('click',()=>$('settings-dialog').close());
$('settings-form').addEventListener('input',previewSettings);$('settings-form').addEventListener('change',previewSettings);
$('eras-all').addEventListener('click',()=>{document.querySelectorAll('[name="era"]').forEach(n=>n.checked=true);previewSettings();});$('eras-none').addEventListener('click',()=>{document.querySelectorAll('[name="era"]').forEach(n=>n.checked=false);previewSettings();});
$('settings-form').addEventListener('submit',e=>{e.preventDefault();const draft=readDraft();if(draftError(draft)){previewSettings();return;}settings=L.normalize(draft);$('settings-dialog').close();startSelectedTrip();});
$('reset-learning').addEventListener('click',()=>$('clear-dialog').showModal());$('cancel-clear').addEventListener('click',()=>$('clear-dialog').close());$('confirm-clear').addEventListener('click',()=>{progress={};$('clear-dialog').close();$('settings-dialog').close();startSelectedTrip();toast('学習記録をリセットしました。');});
render();applyView();save();loadMap();
setInterval(()=>{if(ready)renderClock();},250);document.addEventListener('visibilitychange',()=>{if(ready)renderClock();});window.addEventListener('focus',()=>{if(ready)renderClock();});
