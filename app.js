(function(){
'use strict';
var D=window.DATA,C=window.SirajCore,Sources=window.SirajSources,$=function(i){return document.getElementById(i)},view=$('view'),pb=$('pb'),pop=$('sheet');
var EXTRA=window.SIRAJ_ADDITIONAL_MEANINGS||[],MUY=window.SIRAJ_MUYASSAR_MEANINGS||[],MUY_BY_VERSE=Object.create(null),cur={s:1,v:1},bm=[],words=[],review=null,bmEditing='',bmFilter='all',wordFilter={source:'all',surah:'all'},cfg={fs:1.5,inl:true,rc:'h',wl:false,af:true,rm:{},books:['quran'],prefsVersion:2},DBR=window.SirajRepository||null,NAV=window.SirajNavigation||null,SURAH_META=D.map(function(s){return {n:s.n,count:s.v.length}}),IX=DBR?{pages:NAV.pageStarts,juz:NAV.juzStarts,verses:[],meanings:[],verseMeta:{}}:C.makeIndexes(D,EXTRA,Sources.catalog),JZ=IX.juz,PG=IX.pages,dp=null,tm,navRequest=0,BM_VERSES=Object.create(null);
function indexMuyassar(){MUY_BY_VERSE=Object.create(null);MUY.forEach(function(e){var key=e.s+':'+e.v;(MUY_BY_VERSE[key]||(MUY_BY_VERSE[key]=[])).push(e)})}
if(MUY.length)indexMuyassar();
function selectedMeanings(){return cfg.books[0]==='quran'?[]:EXTRA.concat(cfg.books.indexOf('muyassar')>=0?MUY:[])}
function rebuildIndexes(){if(DBR){IX={pages:NAV.pageStarts,juz:NAV.juzStarts,verses:[],meanings:[],verseMeta:{}};JZ=IX.juz;PG=IX.pages;return}IX=C.makeIndexes(D,selectedMeanings(),Sources.catalog);JZ=IX.juz;PG=IX.pages}
function loadMuyassar(done){if(MUY.length){rebuildIndexes();done();return}function useRows(rows,fromDB){MUY=rows.map(function(x){return {s:x.surah||x.s,v:x.ayah||x.v,term:x.term,meaning:x.meaning,sourceId:x.sourceId||'muyassar',reference:x.reference,wordStart:x.wordStart,wordEnd:x.wordEnd}});indexMuyassar();rebuildIndexes();var ready=window.SirajRepository&&!fromDB?window.SirajRepository.replaceMeaningSource('muyassar',MUY,'muyassar-package-v1').catch(function(){return null}):Promise.resolve();ready.then(function(){done()})}function loadScript(){var sc=document.createElement('script');sc.src='scripts/muyassar-meanings.js';sc.onload=function(){useRows(window.SIRAJ_MUYASSAR_MEANINGS||[],false)};sc.onerror=function(){toast('تعذّر تحميل كتاب الميسّر؛ تحقق من اكتمال تحديث التطبيق');done(false)};document.head.appendChild(sc)}if(DBR)DBR.getMeaningsBySource('muyassar').then(function(rows){if(rows.length)useRows(rows,true);else loadScript()}).catch(loadScript);else loadScript()}
function ld(k,d){return C.readStored(localStorage,k,d)}
function sv(k,v){return C.saveStored(localStorage,k,v)}
function S(s){return D[s-1]}
function activeBook(){return cfg.books[0]==='quran'?'المصحف فقط':cfg.books[0]==='muyassar'?'الميسّر':'السراج'}
function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function ea(t){return esc(t).replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function ad(n){return String(n).replace(/\d/g,function(d){return '٠١٢٣٤٥٦٧٨٩'[d]})}
function rg(t){return Array.from(t).map(function(c){return '\u200f'+c}).join('')}
function isbm(s,v){return bm.some(function(b){return b.s==s&&b.v==v})}
function wordIds(s,v,wordIndex){var ids=[];(S(s).v[v-1].k||[]).forEach(function(g){if(wordIndex>=g[0]&&wordIndex<g[1])ids=ids.concat(g[2])});return ids}
function meaningsFor(s,v,ids,wordIndex){var additional=EXTRA.filter(function(e){return e&&+e.s===+s&&+e.v===+v});if(cfg.books.indexOf('muyassar')>=0)additional=additional.concat(MUY_BY_VERSE[s+':'+v]||[]);if(wordIndex!==undefined&&cfg.books.indexOf('siraj')>=0&&ids===undefined)ids=wordIds(s,v,wordIndex);return Sources.forVerse(S(s).v[v-1].x||[],additional,s,v,ids,Sources.catalog).filter(function(e){if(cfg.books.indexOf(e.sourceId)<0)return false;if(wordIndex!==undefined&&e.sourceId==='siraj'&&cfg.books.indexOf('siraj')>=0)return wordIds(s,v,wordIndex).indexOf(e.anchor)>=0;if(wordIndex!==undefined&&e.sourceId==='muyassar')return e.wordStart!==null&&e.wordStart<=wordIndex&&e.wordEnd>wordIndex;return true})}
function verseElement(s,v){return $('v'+(cfg.pageMode?s+'-':'')+v)}
function tgl(s,v,el){var had=isbm(s,v);bm=C.toggleBookmark(bm,s,v,Date.now());sv('bm',bm);if(el)el.classList.toggle('bk',!had)}
function vh(s,i){
  var V=S(s).v[i],k=V.k||[],x=meaningsFor(s,i+1),out=[],muyAt=MUY_BY_VERSE[s+':'+(i+1)]||[];
  V.w.forEach(function(token,wi){var ids=[],classes=[];if(cfg.books.indexOf('siraj')>=0)k.forEach(function(g){if(wi>=g[0]&&wi<g[1])ids=ids.concat(g[2])});if(ids.length)classes.push('src-siraj');if(cfg.books.indexOf('muyassar')>=0&&muyAt.some(function(e){return e.sourceId==='muyassar'&&Number.isInteger(e.wordStart)&&wi>=e.wordStart&&wi<e.wordEnd}))classes.push('src-muyassar');var renderer=window.SirajMushafRenderer;out.push(renderer?renderer.wordMarkup(token,wi,ids,classes.length>0,classes.join(' ')):(classes.length?'<mark tabindex="0" role="button" aria-label="عرض معنى الكلمة من الكتاب المختار" class="'+classes.join(' ')+'" data-k="'+ids.join(' ')+'" data-word="'+wi+'">'+rg(token)+'</mark>':'<button type="button" class="quran-word quran-word-action" aria-label="عرض معنى الكلمة" data-word="'+wi+'">'+rg(token)+'</button>'))});
  var gl=x.length?'<ul class="gl">'+x.map(function(e){return '<li><b class="'+(e.sourceId==='muyassar'?'src-muyassar':'src-siraj')+'">'+esc(e.term)+'</b> — '+esc(e.meaning)+'<small class="source-label">'+esc(Sources.label(e.sourceId))+'</small></li>'}).join('')+'</ul>':'';
  return '<div class="v'+(isbm(s,i+1)?' bk':'')+'" id="v'+(cfg.pageMode?s+'-':'')+(i+1)+'" data-v="'+(i+1)+'" data-s="'+s+'"><span class="t">'+out.filter(Boolean).join(' ')+'</span> <span class="n t" data-n="1" role="button" tabindex="0" title="خيارات الآية" aria-label="خيارات الآية '+ad(i+1)+' والعلامة المرجعية">'+rg(V.m)+'</span>'+gl+'</div>';
}
function cacheRows(rows){if(DBR)D.forEach(function(meta,i){D[i]={n:SURAH_META[i].n,v:new Array(SURAH_META[i].count)}});var groups=Object.create(null);rows.forEach(function(r){var g=groups[r.surah]||(groups[r.surah]={n:r.surahName,v:new Array(D[r.surah-1].v.length)});g.v[r.ayah-1]={w:r.words,m:r.marker,p:r.page,j:r.juz,e:r.text,k:r.wordLinks||[],x:r.legacyMeanings||[]}});Object.keys(groups).forEach(function(n){D[+n-1]=groups[n]})}
function go(s,v,wordIndex){if(!DBR)return renderGo(s,v,wordIndex);var ticket=++navRequest,dest=C.destination(D,s,v||1);view.setAttribute('aria-busy','true');return DBR.getVerse(dest.s,dest.v).then(function(target){if(!target)throw Error('الآية غير موجودة في قاعدة البيانات المحلية');return cfg.pageMode?DBR.getPage(target.page):DBR.getSurah(dest.s)}).then(function(rows){if(ticket!==navRequest)return;cacheRows(rows);renderGo(dest.s,dest.v,wordIndex)}).catch(function(error){if(ticket===navRequest){view.removeAttribute('aria-busy');toast('تعذّر تحميل موضع المصحف من التخزين المحلي');console.error(error)}}).finally(function(){if(ticket===navRequest)view.removeAttribute('aria-busy')})}
function renderGo(s,v,wordIndex){
  var dest=C.destination(D,s,v||1);s=dest.s;v=dest.v;var A=S(s),targetPage=A.v[v-1].p,h=cfg.pageMode?'<h2>صفحة '+ad(targetPage)+'</h2>':'<h2>سورة '+esc(A.n)+'</h2>',lp=-1;
  if(cfg.pageMode){var lastSurah=0;D.forEach(function(Surah,si){Surah.v.forEach(function(V,i){if(V.p!==targetPage)return;if(V.p!==lp){h+='<div class="pg">صفحة '+ad(V.p)+'</div>';lp=V.p}if(lastSurah!==si+1){h+='<h2>سورة '+esc(Surah.n)+'</h2>';if(i===0&&si+1!==1&&si+1!==9)h+='<div class="bs t">'+NAV.basmalaWords.map(rg).join(' ')+'</div>';lastSurah=si+1}h+=vh(si+1,i)})})}
  else {if(s!==1&&s!==9)h+='<div class="bs t">'+(DBR?NAV.basmalaWords:S(1).v[0].w).map(rg).join(' ')+'</div>';A.v.forEach(function(V,i){if(V.p!==lp){h+='<div class="pg">صفحة '+ad(V.p)+'</div>';lp=V.p}h+=vh(s,i)})}
  if(cfg.pageMode){var prevPage=PG[targetPage-1],nextPage=PG[targetPage+1];h+='<div class="nav"><button data-page="'+(targetPage-1)+'"'+(!prevPage?' disabled':'')+'>الصفحة السابقة</button><button data-page="'+(targetPage+1)+'"'+(!nextPage?' disabled':'')+'>الصفحة التالية</button></div>'}
  else h+='<div class="nav"><button data-d="-1"'+(s==1?' disabled':'')+'>السورة السابقة</button><button data-d="1"'+(s==114?' disabled':'')+'>السورة التالية</button></div>';
  view.innerHTML=h;cur={s:s,v:v};hidePop();closeP();info(S(s).v[v-1]);
  var el=$('v'+(cfg.pageMode?s+'-':'')+v);if(el){el.scrollIntoView();el.classList.add('flash');setTimeout(function(){el.classList.remove('flash')},2300)}else window.scrollTo(0,0);if(wordIndex!==undefined&&view.querySelector){var wordEl=view.querySelector('.v[data-s="'+s+'"][data-v="'+v+'"] mark[data-word="'+wordIndex+'"]');if(wordEl){wordEl.scrollIntoView({block:'center'});wordEl.focus()}}
  sv('last',cur);
}
function goStudyWord(s,v,wordIndex,sourceId){var jump=function(ok){if(ok===false)return;if(sourceId&&Sources.catalog[sourceId]&&cfg.books[0]!==sourceId){cfg.books=[sourceId];rebuildIndexes();sv('cfg',cfg)}go(s,v,wordIndex)};if(sourceId==='muyassar'&&!MUY.length)loadMuyassar(jump);else jump()}
function info(V){$('ttl').textContent='سورة '+S(cur.s).n+' · ص '+ad(V.p)+' · ج '+ad(V.j)+' · '+activeBook()}
function track(){var hh=$('bar').offsetHeight+4,vs=view.querySelectorAll('.v');for(var i=0;i<vs.length;i++){if(vs[i].getBoundingClientRect().bottom>hh){cur.s=+(vs[i].dataset.s||cur.s);cur.v=+vs[i].dataset.v;sv('last',cur);info(S(cur.s).v[cur.v-1]);break}}}
window.addEventListener('scroll',function(){clearTimeout(tm);tm=setTimeout(track,300)},{passive:true});
/* bottom sheet: meanings + actions */
var SH={s:0,v:0};
function hap(){try{var H=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.Haptics;if(H)H.impact({style:'LIGHT'});else if(navigator.vibrate)navigator.vibrate(12)}catch(e){}}
function showSheet(vEl,ids,wordIndex){
  var s=+(vEl.dataset.s||cur.s),v=+vEl.dataset.v,base=S(s).v[v-1].x||[],h='',entries=meaningsFor(s,v,ids,wordIndex),source;
  SH={s:s,v:v,ids:ids||(wordIndex!==undefined?wordIds(s,v,wordIndex):base.map(function(_,i){return i})),entries:entries,wordIndex:wordIndex};
  entries.forEach(function(e,i){source=Sources.get(e.sourceId);var item={s:s,v:v,term:e.term,meaning:e.meaning,sourceId:e.sourceId},saved=words.some(function(w){return C.studyKey(w)===C.studyKey(item)});
    h+='<article class="we-card"><div class="we"><b>'+esc(e.term)+'</b> — '+esc(e.meaning)+'</div><small class="source-label">'+esc(Sources.label(e.sourceId))+(e.reference?' · '+esc(e.reference):source&&source.editionNote?' · '+esc(source.editionNote):'')+'</small><button class="word-save" data-a="word" data-i="'+i+'">'+(saved?'✓ محفوظ في دفتر المفردات':'＋ أضف إلى دفتر المفردات')+'</button></article>'});
  if(!h)h='<div class="we" style="color:var(--mut)">'+(cfg.books[0]==='quran'?'وضع «المصحف فقط» مفعّل. اختر كتابًا من الإعدادات لعرض معاني الغريب.':'لا توجد معانٍ من الكتاب المختار في هذا الموضع.')+'</div>';
  pop.innerHTML='<div class="sh-h"><span>'+esc(S(s).n)+' · آية '+ad(v)+'</span><button data-a="x" aria-label="إغلاق">✕</button></div>'+h+'<div class="sh-b"><button class="bookmark-action" data-a="bm">'+(isbm(s,v)?'✅ إزالة العلامة المرجعية':'🔖 حفظ الآية في العلامات')+'</button><button data-a="pl">▶ استماع</button><button data-a="cd">🖼 بطاقة</button><button data-a="cp">⧉ نسخ</button></div>';
  pop.style.display='block';hap();
}
function hidePop(){pop.style.display='none'}
function copyV(s,v){var V=S(s).v[v-1],t='﴿'+V.e+'﴾ ['+S(s).n+': '+v+']'+meaningsFor(s,v).map(function(e){return '\n'+e.term+': '+e.meaning+' ('+Sources.label(e.sourceId)+(e.reference?'، '+e.reference:'')+')'}).join('');
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast('تم النسخ')},function(){toast('تعذّر النسخ')});hidePop()}
pop.addEventListener('click',function(e){var b=e.target.closest('[data-a]');if(!b)return;var k=b.dataset.a,s=SH.s,v=SH.v;e.stopPropagation();
  if(k==='x')hidePop();else if(k==='bm'){tgl(s,v,verseElement(s,v));hap();showSheet(verseElement(s,v))}
  else if(k==='word'){var entry=SH.entries[+b.dataset.i];if(entry){var item={s:s,v:v,term:entry.term,meaning:entry.meaning,sourceId:entry.sourceId,reference:entry.reference,wordIndex:SH.wordIndex},wasSaved=words.some(function(w){return C.studyKey(w)===C.studyKey(item)}),previous=words;words=C.toggleStudyWord(words,Object.assign(item,{savedAt:Date.now(),reviewStep:0,nextReviewAt:Date.now(),reviewCount:0}));if(!sv('words',words)){words=previous;toast('تعذّر حفظ دفتر المفردات؛ تحقق من مساحة التخزين')}else toast(wasSaved?'أُزيلت الكلمة من دفتر المفردات':'أُضيفت الكلمة إلى دفتر المفردات');showSheet($('v'+v),SH.ids,SH.wordIndex)}}
  else if(k==='pl'){hidePop();playAt(s,v)}else if(k==='cd')card(s,v);else if(k==='cp')copyV(s,v)});
view.addEventListener('click',function(e){var t=e.target,mk=t.closest('mark'),qw=t.closest('.quran-word-action'),n=t.closest('[data-n]'),b=t.closest('.nav button');
  if(mk){var wi=mk.getAttribute('data-word');showSheet(mk.closest('.v'),mk.getAttribute('data-k').split(' ').filter(Boolean).map(Number),wi===null?undefined:+wi);e.stopPropagation()}
  else if(qw){showSheet(qw.closest('.v'),undefined,+qw.getAttribute('data-word'));e.stopPropagation()}
  else if(n){showSheet(n.closest('.v'));e.stopPropagation()}
  else if(b&&b.hasAttribute('data-page')){var loc=PG[+b.getAttribute('data-page')];if(loc)go(loc[0],loc[1])}
  else if(b&&!b.disabled)go(cur.s+parseInt(b.getAttribute('data-d'),10),1)});
view.addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.target.tagName==='MARK'||e.target.classList.contains('quran-word-action')||e.target.hasAttribute('data-n')))e.target.click()});
document.addEventListener('click',function(e){if(!e.target.closest('#sheet'))hidePop()});
/* share card (canvas) */
function card(s,v){hidePop();var V=S(s).v[v-1];
  document.fonts.load('60px HafsSmart','\ue95a').then(function(){
  var W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d'),cs=getComputedStyle(document.documentElement),g=function(n){return cs.getPropertyValue(n).trim()};
  x.fillStyle=g('--bg');x.fillRect(0,0,W,H);x.strokeStyle=g('--hlb');x.lineWidth=6;x.strokeRect(36,36,W-72,H-72);x.lineWidth=2;x.strokeRect(54,54,W-108,H-108);
  x.direction='rtl';x.textAlign='center';x.fillStyle=g('--fg');
  var UI='"Noto Naskh Arabic","Amiri","Traditional Arabic",serif';
  function wrap(tk,mw,f){x.font=f;var L=[],c2='';tk.forEach(function(t){var q=c2?c2+' '+t:t;if(x.measureText(q).width>mw&&c2){L.push(c2);c2=t}else c2=q});if(c2)L.push(c2);return L}
  x.font='bold 44px '+UI;x.fillText('سورة '+S(s).n+' — آية '+ad(v),W/2,135);
  var tk=V.w.map(rg).concat([rg(V.m)]),fs=64,L;
  do{L=wrap(tk,W-200,fs+'px HafsSmart');if(L.length*fs*1.9<=620)break;fs-=4}while(fs>28);
  var y=190;x.font=fs+'px HafsSmart';L.forEach(function(l){y+=fs*1.9;x.fillText(l,W/2,y-fs*.5)});
  y+=50;var xs=meaningsFor(s,v);
  if(xs.length){x.fillStyle=g('--hlb');x.font='bold 36px '+UI;x.fillText('من غريب القرآن ('+activeBook()+')',W/2,y);y+=30;x.fillStyle=g('--fg');
    for(var i=0;i<xs.length&&y<H-190;i++){var q=wrap((xs[i].term+': '+xs[i].meaning).split(' '),W-220,'34px '+UI);for(var k=0;k<q.length&&y<H-190;k++){y+=48;x.font='34px '+UI;x.fillText(q[k],W/2,y)}y+=14}}
  x.fillStyle=g('--mut');x.font='30px '+UI;x.fillText('تطبيق غريب القرآن',W/2,H-85);
  c.toBlob(function(b){shareImg(b,'سورة '+S(s).n+' آية '+v)},'image/png')})}
function shareImg(blob,text){var P=window.Capacitor&&Capacitor.Plugins||{},f=new File([blob],'ayah.png',{type:'image/png'});
  if(P.Filesystem&&P.Share){var r=new FileReader();r.onload=function(){P.Filesystem.writeFile({path:'ayah.png',data:String(r.result).split(',')[1],directory:'CACHE'}).then(function(w){return P.Share.share({title:text,files:[w.uri]})}).catch(function(){toast('تعذّرت المشاركة')})};r.readAsDataURL(blob);return}
  if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f],text:text}).catch(function(){});
  else{var l=document.createElement('a');l.href=URL.createObjectURL(blob);l.download='ayah.png';l.click();toast('تم تنزيل الصورة')}}
/* audio: streaming + offline (IndexedDB) */
var REC={h:['الحصري','Husary_64kbps'],m:['المنشاوي (مرتل)','Minshawy_Murattal_128kbps']},au=new Audio(),ap={s:0,v:0,end:0,start:0,remaining:1,dl:false,dlToken:0,dlController:null},db=null;
function p3(n){return ('00'+n).slice(-3)}
function aurl(s,v,r){return 'https://everyayah.com/data/'+REC[r][1]+'/'+p3(s)+p3(v)+'.mp3'}
function idb(){
  if(db)return db;
  var pending=new Promise(function(ok,no){var r=indexedDB.open('siraj-audio',1);
    r.onupgradeneeded=function(){if(!r.result.objectStoreNames||!r.result.objectStoreNames.contains||!r.result.objectStoreNames.contains('a'))r.result.createObjectStore('a')};
    r.onsuccess=function(){if(db!==pending){r.result.close();return}r.result.onversionchange=function(){r.result.close();db=null};ok(r.result)};
    r.onerror=function(){no(r.error)};r.onblocked=function(){no(Error('IndexedDB is blocked by another app window'))}
  });
  db=pending;pending.catch(function(){if(db===pending)db=null});return pending
}
function ig(k){return idb().then(function(d){return new Promise(function(ok){var q=d.transaction('a').objectStore('a').get(k);q.onsuccess=function(){ok(q.result)};q.onerror=function(){ok()}})})}
function ip(k,b){return idb().then(function(d){return new Promise(function(ok,no){var t=d.transaction('a','readwrite');t.objectStore('a').put(b,k);t.oncomplete=ok;t.onerror=function(){no(t.error||Error('Audio cache write failed'))};t.onabort=function(){no(t.error||Error('Audio cache write was aborted'))}})})}
function iclear(){return idb().then(function(d){return new Promise(function(ok,no){var t=d.transaction('a','readwrite');t.objectStore('a').clear();t.oncomplete=ok;t.onerror=function(){no(t.error||Error('Audio cache clear failed'))};t.onabort=function(){no(t.error||Error('Audio cache clear was aborted'))}})})}
function clearReciter(r){return idb().then(function(d){return new Promise(function(ok,no){var t=d.transaction('a','readwrite'),st=t.objectStore('a'),q=st.getAllKeys();q.onsuccess=function(){q.result.filter(function(k){return String(k).indexOf(r+'/')===0}).forEach(function(k){st.delete(k)})};q.onerror=function(){no(q.error||Error('Audio key read failed'))};t.oncomplete=ok;t.onerror=function(){no(t.error||Error('Audio delete failed'))};t.onabort=function(){no(t.error||Error('Audio delete aborted'))}})})}
function audioStats(done){if(!window.indexedDB){done(null);return}idb().then(function(d){return new Promise(function(ok,no){var st=d.transaction('a').objectStore('a'),q=st.getAllKeys(),v=st.getAll();q.onerror=v.onerror=function(){no(Error('تعذّر قراءة قائمة التنزيلات'))};var keys,vals;q.onsuccess=function(){keys=q.result;finish()};v.onsuccess=function(){vals=v.result;finish()};function finish(){if(!keys||!vals)return;var r={h:{count:0,bytes:0},m:{count:0,bytes:0}};keys.forEach(function(k,i){var id=String(k).split('/')[0];if(r[id]){r[id].count++;r[id].bytes+=vals[i]&&vals[i].size||0}});ok(r)}})}).then(done,function(){done(null)})}
function uiP(){$('pt').textContent=au.paused?'▶':'⏸';if($('pt').setAttribute)$('pt').setAttribute('aria-pressed',String(!au.paused));$('pl-t').textContent=REC[cfg.rc][0]+' · '+S(ap.s).n+' · آية '+ad(ap.v)}
function playAt(s,v,rangeStart,rangeEnd,remaining){
  if(s!==cur.s||!verseElement(s,v)){var pending=go(s,v);if(pending&&typeof pending.then==='function')return pending.then(function(){return playAt(s,v,rangeStart,rangeEnd,remaining)})}
  if(rangeStart!==undefined){ap.start=rangeStart;ap.end=rangeEnd;ap.remaining=remaining||1}else{ap.start=v;ap.end=S(s).v.length;ap.remaining=Math.max(1,+cfg.repeatCount||1)}
  ap.s=s;ap.v=v;var k=cfg.rc+'/'+p3(s)+p3(v);
  document.querySelectorAll('.v.playing').forEach(function(e){e.classList.remove('playing')});
  var el=$('v'+(cfg.pageMode?s+'-':'')+v);if(el){el.classList.add('playing');if(cfg.af)el.scrollIntoView({block:'center',behavior:'smooth'})}
  $('player').hidden=false;
  au.playbackRate=+cfg.audioSpeed||1;ig(k).then(function(b){if(au._u){URL.revokeObjectURL(au._u);au._u=null}if(b){au._u=URL.createObjectURL(b);au.src=au._u}else au.src=aurl(s,v,cfg.rc);au.playbackRate=+cfg.audioSpeed||1;return au.play()}).then(uiP,function(){toast('تعذّر تشغيل الصوت؛ تحقق من الاتصال أو نزّل السورة');uiP()});uiP();
}
au.onended=function(){if(au.loop)return;if(ap.v<(ap.end||S(ap.s).v.length))playAt(ap.s,ap.v+1,ap.start,ap.end,ap.remaining);else if(ap.remaining>1){ap.remaining--;playAt(ap.s,ap.start,ap.start,ap.end,ap.remaining)}else{ap.start=0;ap.end=0;uiP()}};
au.onpause=au.onplay=uiP;
function dlSurah(){var s=ap.s||cur.s,n=S(s).v.length,i=0,r=cfg.rc,b=$('pdl');
  if(ap.dl){ap.dl=false;ap.dlToken++;var c=ap.dlController;ap.dlController=null;if(c)c.abort();b.textContent='⬇';toast(c?'أُوقف التنزيل':'سيُوقف التنزيل بعد الآية الحالية');return}
  ap.dl=true;var token=++ap.dlToken;ap.dlController=typeof AbortController==='function'?new AbortController():null;b.textContent='٠/'+ad(n)+' ✕';
  try{if(navigator.storage&&navigator.storage.persist){var persisted=navigator.storage.persist();if(persisted&&persisted.catch)persisted.catch(function(){})}}catch(e){}
  var downloadedBytes=0;(function nx(){if(token!==ap.dlToken)return;if(!ap.dl||i>=n){var done=i>=n;ap.dl=false;ap.dlController=null;b.textContent='⬇';toast(done?'اكتمل تنزيل السورة ('+(downloadedBytes/1048576).toFixed(1)+' MB)':'أُوقف التنزيل');return}
    i++;var k=r+'/'+p3(s)+p3(i);
    ig(k).then(function(h){if(h){downloadedBytes+=h.size||0;return}return fetch(aurl(s,i,r),ap.dlController?{signal:ap.dlController.signal}:undefined).then(function(x){if(!x.ok)throw Error('HTTP '+x.status);return x.blob()}).then(function(bl){downloadedBytes+=bl.size||0;return ip(k,bl)})}).then(function(){if(token!==ap.dlToken)return;b.textContent=ad(i)+'/'+ad(n)+' · '+(downloadedBytes/1048576).toFixed(1)+' MB ✕';nx()},function(err){if(token!==ap.dlToken)return;ap.dl=false;ap.dlController=null;b.textContent='⬇';toast(err&&err.name==='AbortError'?'أُوقف التنزيل':'تعذّر التنزيل؛ حُفظ ما اكتمل')})})()}
$('pt').onclick=function(){if(!ap.v)playAt(cur.s,cur.v);else if(au.paused)au.play();else au.pause()};
$('pv').onclick=function(){if(ap.v>1)playAt(ap.s,ap.v-1)};
$('pn2').onclick=function(){if(ap.v<S(ap.s).v.length)playAt(ap.s,ap.v+1)};
$('px').onclick=function(){au.pause();$('player').hidden=true;document.querySelectorAll('.v.playing').forEach(function(e){e.classList.remove('playing')})};
$('pl-loop').onclick=function(){au.loop=!au.loop;if(this.setAttribute)this.setAttribute('aria-pressed',String(au.loop));this.textContent=au.loop?'↻١':'↻';toast(au.loop?'تكرار الآية مفعّل':'تكرار الآية متوقف')};
$('pdl').onclick=dlSurah;$('au').onclick=function(){playAt(cur.s,cur.v)};
$('pr').innerHTML=Object.keys(REC).map(function(k){return '<option value="'+k+'">'+REC[k][0]+'</option>'}).join('');
$('pr').onchange=function(){cfg.rc=this.value;sv('cfg',cfg);if(ap.v&&!au.paused)playAt(ap.s,ap.v)};
if($('p-speed')){$('p-speed').value=String(cfg.audioSpeed||1);$('p-speed').onchange=function(){cfg.audioSpeed=Math.max(.75,Math.min(1.5,+this.value||1));au.playbackRate=cfg.audioSpeed;sv('cfg',cfg)}}
if($('p-repeat')){$('p-repeat').value=String(cfg.repeatCount||1);$('p-repeat').onchange=function(){cfg.repeatCount=Math.max(1,Math.min(10,+this.value||1));sv('cfg',cfg)}}
if($('p-range'))$('p-range').onclick=function(){var a=+$('p-start').value||ap.v||cur.v,b=+$('p-end').value||S(cur.s).v.length;if(a>b||b>S(cur.s).v.length){toast('نطاق الآيات غير صالح');return}playAt(cur.s,a,a,b,Math.max(1,+cfg.repeatCount||1))};
/* wake lock */
var wlk=null;function wake(){if(!cfg.wl||!navigator.wakeLock)return;navigator.wakeLock.request('screen').then(function(l){wlk=l;l.addEventListener('release',function(){wlk=null})}).catch(function(){})}
function unwake(){if(wlk){wlk.release();wlk=null}}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')wake()});
/* themes + native status bar */
var TH={light:['#ffffff','LIGHT'],sepia:['#f8f0dc','LIGHT'],dark:['#211f17','DARK']};
function theme(t,save){if(!TH[t])t='light';document.documentElement.dataset.theme=t;if(save!==false)sv('theme',t);
  var m=document.querySelector('meta[name=theme-color]');if(m)m.content=TH[t][0];
  try{var SB=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.StatusBar;if(SB){SB.setBackgroundColor({color:TH[t][0]}).catch(function(){});SB.setStyle({style:TH[t][1]}).catch(function(){})}}catch(e){}}
function tt(){var o=['light','sepia','dark'],t=document.documentElement.dataset.theme;theme(o[(o.indexOf(t)+1)%3])}
/* local reminders (native only) */
var LN=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.LocalNotifications;
function sched(){if(!LN)return;var r=cfg.rm||{},L=[],t;
  LN.cancel({notifications:[{id:1},{id:2}]}).catch(function(){}).then(function(){
    if(r.d&&r.d.on){t=r.d.t.split(':');L.push({id:1,title:'الورد اليومي',body:'حان وقت وردك من القرآن الكريم',schedule:{on:{hour:+t[0],minute:+t[1]},allowWhileIdle:true},extra:{go:'last'}})}
    if(r.k&&r.k.on){t=r.k.t.split(':');L.push({id:2,title:'سورة الكهف',body:'لا تنس قراءة سورة الكهف يوم الجمعة',schedule:{on:{weekday:6,hour:+t[0],minute:+t[1]},allowWhileIdle:true},extra:{go:'kahf'}})}
    if(L.length)return LN.requestPermissions().then(function(p){if(p.display==='granted')return LN.schedule({notifications:L});toast('لم يُمنح إذن الإشعارات')})})}
if(LN)LN.addListener('localNotificationActionPerformed',function(a){var g=a.notification&&a.notification.extra&&a.notification.extra.go;if(g==='kahf')go(18,1)});
/* panel */
var tabs=[['sur','السور'],['juz','الأجزاء'],['pag','الصفحات'],['bm','🔖 العلامات'],['words','المفردات'],['q','بحث'],['set','الإعدادات']];
function openP(t){$('panel').classList.add('open');$('ov').hidden=false;tab(t||'sur')}
function closeP(){$('panel').classList.remove('open');$('ov').hidden=true}
function tab(t){
  $('tabs').innerHTML=tabs.map(function(x){return '<button data-t="'+x[0]+'"'+(x[0]===t?' class="on"':'')+'>'+x[1]+'</button>'}).join('');
  pb.innerHTML='';T[t]();
}
function gb(s,v,a,b){return '<button data-go="'+s+','+v+'">'+a+(b?'<small>'+b+'</small>':'')+'</button>'}
function backupFileName(){return 'siraj-backup-'+new Date().toISOString().slice(0,10)+'.json'}
function exportBackup(){
  var payload=JSON.stringify(C.createBackup({last:ld('last',null),bookmarks:bm,settings:cfg,theme:document.documentElement.dataset.theme||'light',words:words}),null,2),name=backupFileName(),P=window.Capacitor&&Capacitor.Plugins||{};
  if(P.Filesystem&&P.Share){var fr=new FileReader();fr.onload=function(){P.Filesystem.writeFile({path:name,data:String(fr.result).split(',')[1],directory:'CACHE'}).then(function(file){return P.Share.share({title:'نسخة احتياطية من السراج',files:[file.uri]})}).catch(function(){toast('تعذّر إنشاء النسخة الاحتياطية')})};fr.onerror=function(){toast('تعذّر قراءة بيانات النسخة الاحتياطية')};fr.readAsDataURL(new Blob([payload],{type:'application/json'}));return}
  try{var a=document.createElement('a'),url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000);toast('تم تجهيز النسخة الاحتياطية')}catch(e){toast('تعذّر تنزيل النسخة الاحتياطية')}
}
function restoreBackupText(text){
  var parsed=C.parseBackup(text,D,Object.keys(Sources.catalog));if(parsed.errors.length){toast(parsed.errors.join('؛ '));return}
  if(!confirm('ستُستبدل العلامات ودفتر المفردات والإعدادات وموضع القراءة الحالي بمحتوى النسخة. هل تريد المتابعة؟'))return;
  var data=parsed.data,keys=['last','bm','words','cfg','theme'],values={last:JSON.stringify(data.last),bm:JSON.stringify(data.bookmarks),words:JSON.stringify(data.words),cfg:JSON.stringify(data.settings),theme:JSON.stringify(data.theme)},old={};
  try{keys.forEach(function(k){old[k]=localStorage.getItem(k)});keys.forEach(function(k){localStorage.setItem(k,values[k])})}
  catch(e){keys.forEach(function(k){try{if(old[k]===null)localStorage.removeItem(k);else if(old[k]!==undefined)localStorage.setItem(k,old[k])}catch(_){}});toast('تعذّرت استعادة النسخة؛ لم تُعتمد البيانات');return}
  bm=data.bookmarks;words=data.words;cfg=data.settings;theme(data.theme);ac();if(LN)sched();var last=data.last||{s:1,v:1},finish=function(){go(last.s,last.v);toast('تمت استعادة النسخة الاحتياطية')};if(cfg.books.indexOf('muyassar')>=0)loadMuyassar(finish);else finish();
}
function importBackupFile(file){if(!file)return;var reader=new FileReader();reader.onload=function(){restoreBackupText(String(reader.result||''))};reader.onerror=function(){toast('تعذّرت قراءة ملف النسخة الاحتياطية')};reader.readAsText(file)}
function filteredWords(){return words.map(function(item,index){return {item:item,index:index}}).filter(function(row){return (wordFilter.source==='all'||(row.item.sourceId||'siraj')===wordFilter.source)&&(wordFilter.surah==='all'||+row.item.s===+wordFilter.surah)})}
function beginReview(mode){review={mode:mode||'cards',queue:C.dueStudyWords(filteredWords().map(function(x){return x.item}),Date.now()).map(C.studyKey),index:0,revealed:false};showReview()}
function showReview(){
  if(!review)return T.words();
  var key=review.queue[review.index],item=words.find(function(w){return C.studyKey(w)===key});
  if(!item){pb.innerHTML='<div class="review-done"><h3>أحسنت، انتهت مراجعة اليوم</h3><p>لا توجد كلمات أخرى حان موعد مراجعتها.</p><button id="review-back">العودة إلى المفردات</button></div>';var back=$('review-back');if(back)back.onclick=function(){review=null;T.words()};return}
  var verse=S(item.s).v[item.v-1],source=Sources.get(item.sourceId),h='<section class="review-card"><div class="review-progress">الكلمة '+ad(review.index+1)+' من '+ad(review.queue.length)+'</div><h3>'+esc(item.term)+'</h3><p class="review-location">سورة '+esc(S(item.s).n)+' · آية '+ad(item.v)+'</p><p class="review-context">'+esc(verse.e)+'</p><small class="source-label">'+esc(Sources.label(item.sourceId))+(item.reference?' · '+esc(item.reference):source&&source.editionNote?' · '+esc(source.editionNote):'')+'</small>';
  if(review.mode==='quiz'){var choices=C.reviewQuizOptions(words,item,4);h+='<div class="quiz-options">'+choices.map(function(choice,i){return '<button data-quiz="'+i+'">'+esc(choice.meaning)+'</button>'}).join('')+'</div><p id="quiz-feedback" aria-live="polite"></p>'}
  else if(review.revealed)h+='<div class="review-answer"><b>المعنى</b><p>'+esc(item.meaning)+'</p></div>';
  h+='</section><div class="review-actions">'+(review.mode==='quiz'?'':review.revealed?'<button id="review-again">أحتاج إلى مراجعتها</button><button id="review-known">أتقنتها</button>':'<button id="review-reveal">إظهار المعنى</button>')+'<button id="review-stop" class="subtle">إنهاء المراجعة</button></div>';
  pb.innerHTML=h;var reveal=$('review-reveal'),again=$('review-again'),known=$('review-known'),stop=$('review-stop');
  if(reveal)reveal.onclick=function(){review.revealed=true;showReview()};
  function grade(remembered){var previous=words,updated=C.gradeStudyWord(item,remembered,Date.now());words=words.map(function(w){return C.studyKey(w)===key?updated:w});if(!sv('words',words)){words=previous;toast('تعذّر حفظ التقدم؛ تحقق من مساحة التخزين');return}review.index++;review.revealed=false;showReview()}
  if(review.mode==='quiz'&&pb.querySelectorAll)pb.querySelectorAll('[data-quiz]').forEach(function(button){button.onclick=function(){var correct=button.textContent===item.meaning,feedback=$('quiz-feedback');if(feedback)feedback.textContent=correct?'إجابة صحيحة':'الإجابة الصحيحة: '+item.meaning;pb.querySelectorAll('[data-quiz]').forEach(function(b){b.disabled=true});setTimeout(function(){grade(correct)},650)}});
  if(again)again.onclick=function(){grade(false)};if(known)known.onclick=function(){grade(true)};
  if(stop)stop.onclick=function(){review=null;T.words()};
}
var T={
  sur:function(){pb.innerHTML='<div class="grid">'+D.map(function(A,i){return gb(i+1,1,ad(i+1)+'. '+esc(A.n),ad(A.v.length)+' آية')}).join('')+'</div>'},
  juz:function(){var h='';for(var j=1;j<=30;j++)h+=gb(JZ[j][0],JZ[j][1],'الجزء '+ad(j),esc(S(JZ[j][0]).n));pb.innerHTML='<div class="grid">'+h+'</div>'},
  pag:function(){pb.innerHTML='<input type="number" id="pn" min="1" max="604" placeholder="رقم الصفحة (١–٦٠٤)" inputmode="numeric"><button id="pgo" style="width:100%">اذهب</button><p id="pm"></p>';
    $('pgo').onclick=function(){var n=+$('pn').value;if(PG[n])go(PG[n][0],PG[n][1]);else $('pm').textContent='رقم صفحة غير صحيح'}},
  q:function(){var scopes=cfg.books[0]==='quran'?'<option value="q">نص القرآن فقط</option>':'<option value="a">القرآن والمعاني</option><option value="q">نص القرآن فقط</option><option value="m">معاني الغريب فقط</option>';pb.innerHTML='<input type="search" id="qi" placeholder="ابحث في الآيات أو المعاني…" autocomplete="off" aria-label="كلمات البحث"><select id="qs" aria-label="نطاق البحث">'+scopes+'</select><div class="study-filters"><label>السورة<select id="q-surah"><option value="all">كل السور</option>'+D.map(function(x,i){return '<option value="'+(i+1)+'">'+esc(x.n)+'</option>'}).join('')+'</select></label><label>الجزء<select id="q-juz"><option value="all">كل الأجزاء</option>'+Array.from({length:30},function(_,i){return '<option value="'+(i+1)+'">'+ad(i+1)+'</option>'}).join('')+'</select></label><label>الصفحة<input id="q-page" type="number" min="1" max="604" placeholder="كل الصفحات"></label></div><div id="qr"></div>';
    var t;function run(){find($('qi').value,$('qs').value,$('qr'))}$('qi').oninput=function(){clearTimeout(t);t=setTimeout(run,250)};$('qs').onchange=run;['q-surah','q-juz','q-page'].forEach(function(id){$(id).oninput=run;$(id).onchange=run});$('qi').focus()},
  set:function(){var r=cfg.rm=cfg.rm||{},d=r.d||{on:false,t:'05:00'},k=r.k||{on:false,t:'09:00'},th=document.documentElement.dataset.theme;
    pb.innerHTML='<label>حجم الخط<input type="range" id="fs" min="1.1" max="2.8" step="0.1" value="'+cfg.fs+'" style="width:100%"></label>'+
    '<div class="row"><input type="checkbox" id="inl"'+(cfg.inl?' checked':'')+'><label for="inl">إظهار المعاني تحت كل آية</label></div>'+ '<div class="row"><input type="checkbox" id="page-mode"'+(cfg.pageMode?' checked':'')+'><label for="page-mode">عرض المصحف صفحةً صفحة</label></div>'+ '<fieldset class="book-select"><legend>طريقة القراءة</legend>'+[['quran','المصحف فقط','book-quran'],['siraj','السراج','src-siraj'],['muyassar','الميسّر','src-muyassar']].map(function(x){return '<label class="book-option"><input type="radio" name="meaning-book" data-book="'+x[0]+'" value="'+x[0]+'"'+(cfg.books[0]===x[0]?' checked':'')+'><span class="'+x[2]+'">'+x[1]+'</span></label>'}).join('')+'</fieldset>'+ '<div class="source-legend"><span class="'+(cfg.books[0]==='muyassar'?'src-muyassar':cfg.books[0]==='quran'?'book-quran':'src-siraj')+'">'+activeBook()+(cfg.books[0]==='quran'?' · دون معاني':'')+'</span></div>'+ 
    '<div class="row" id="ths">'+[['light','نهاري'],['sepia','ورقي'],['dark','داكن']].map(function(x){return '<button data-th="'+x[0]+'"'+(th===x[0]?' class="on"':'')+'>'+x[1]+'</button>'}).join('')+'</div>'+
    '<div class="row"><input type="checkbox" id="wl"'+(cfg.wl?' checked':'')+'><label for="wl">إبقاء الشاشة مضاءة أثناء القراءة</label></div>'+
    '<div class="row"><input type="checkbox" id="af"'+(cfg.af?' checked':'')+'><label for="af">تحريك الصفحة مع التلاوة</label></div>'+
    '<div id="astat" class="audio-storage" aria-live="polite">حالة التلاوات المحفوظة</div><div class="row audio-storage-actions"><button data-clear-reciter="h">حذف تنزيلات الحصري</button><button data-clear-reciter="m">حذف تنزيلات المنشاوي</button></div>'+ 
    (LN?'<hr><b>التذكير</b><div class="row"><input type="checkbox" id="rd"'+(d.on?' checked':'')+'><label for="rd">الورد اليومي</label><input type="time" id="rdt" value="'+d.t+'"></div><div class="row"><input type="checkbox" id="rk"'+(k.on?' checked':'')+'><label for="rk">سورة الكهف يوم الجمعة</label><input type="time" id="rkt" value="'+k.t+'"></div>':'<p style="color:var(--mut);font-size:.85rem">التذكيرات متوفرة في تطبيق أندرويد.</p>')+
     '<div class="row"><button id="adel">حذف التلاوات المحفوظة</button></div>'+ '<hr><b>نسخة احتياطية لبياناتك</b><div class="backup-actions"><button id="backup-export">تصدير النسخة</button><button id="backup-import">استعادة نسخة</button><input id="backup-file" type="file" accept="application/json,.json" hidden></div><p class="privacy-storage">تُحفظ العلامات والمفردات والإعدادات وموضع القراءة والتنزيلات الصوتية على هذا الجهاز.</p><button id="clear-personal">مسح بيانات الاستخدام المحلية</button>'+(dp?'<div class="row"><button id="ins">تثبيت التطبيق على الجهاز</button></div>':'')+
     '<p style="color:var(--mut);font-size:.85rem">اضغط على الكلمة المظلَّلة لعرض معناها ومصدره، ويمكنك حفظ الكلمات لمراجعتها من تبويب «المفردات». كتاب الميسّر من حزمة المطورين الرسمية لمجمع الملك فهد.</p>';
    $('fs').oninput=function(){cfg.fs=+this.value;ac()};$('inl').onchange=function(){cfg.inl=this.checked;ac()};$('page-mode').onchange=function(){cfg.pageMode=this.checked;sv('cfg',cfg);go(cur.s,cur.v);openP('set')};
    if(pb.querySelectorAll)pb.querySelectorAll('[data-book]').forEach(function(input){input.onchange=function(){var self=this,prev=cfg.books.slice(),next=[this.value];function apply(ok){if(ok===false){cfg.books=prev;self.checked=false;var old=pb.querySelector('[data-book="'+prev[0]+'"]');if(old)old.checked=true;return}cfg.books=next;rebuildIndexes();sv('cfg',cfg);go(cur.s,cur.v);openP('set')}if(next[0]==='muyassar')loadMuyassar(apply);else apply(true)}});
    $('ths').onclick=function(e){var b=e.target.closest('[data-th]');if(b){theme(b.dataset.th);T.set()}};
    $('wl').onchange=function(){cfg.wl=this.checked;sv('cfg',cfg);if(cfg.wl)wake();else unwake()};
    $('af').onchange=function(){cfg.af=this.checked;sv('cfg',cfg)};
    if(window.indexedDB)audioStats(function(stats){var el=$('astat');if(!el||!stats)return;el.textContent='التلاوات المحفوظة — الحصري: '+stats.h.count+' ('+(stats.h.bytes/1048576).toFixed(1)+' MB)، المنشاوي: '+stats.m.count+' ('+(stats.m.bytes/1048576).toFixed(1)+' MB)'});
    if(pb.querySelectorAll)pb.querySelectorAll('[data-clear-reciter]').forEach(function(button){button.onclick=function(){var id=this.getAttribute('data-clear-reciter');clearReciter(id).then(function(){toast('حُذفت تنزيلات '+REC[id][0]);audioStats(function(stats){var el=$('astat');if(stats&&el)el.textContent='التلاوات المحفوظة — الحصري: '+stats.h.count+' ('+(stats.h.bytes/1048576).toFixed(1)+' MB)، المنشاوي: '+stats.m.count+' ('+(stats.m.bytes/1048576).toFixed(1)+' MB)'})},function(){toast('تعذّر حذف تنزيلات القارئ')})}});
    $('adel').onclick=function(){iclear().then(function(){toast('حُذفت كل التلاوات المحفوظة');audioStats(function(stats){var el=$('astat');if(stats&&el)el.textContent='لا توجد تلاوات محفوظة'})})};
     $('clear-personal').onclick=function(){if(!confirm('سيُحذف موضع القراءة والعلامات والمفردات والإعدادات والسمة والتنزيلات الصوتية من هذا الجهاز. لن يُحذف نص المصحف أو الكتب. هل تريد المتابعة؟'))return;var keys=['last','bm','words','cfg','theme'];keys.forEach(function(k){localStorage.removeItem(k)});au.pause();bm=[];words=[];cfg=C.sanitizeSettings({},Object.keys(Sources.catalog));theme('light',false);if(LN)sched();Promise.resolve(window.indexedDB?iclear():undefined).then(function(){go(1,1);localStorage.removeItem('last');T.set();toast('مُسحت بيانات الاستخدام المحلية')},function(){go(1,1);localStorage.removeItem('last');T.set();toast('مُسحت بيانات القراءة لكن تعذّر حذف بعض التنزيلات الصوتية')})};
     $('backup-export').onclick=exportBackup;$('backup-import').onclick=function(){$('backup-file').click()};$('backup-file').onchange=function(){var f=this.files&&this.files[0];importBackupFile(f);this.value=''};
    if(LN){var up=function(){cfg.rm={d:{on:$('rd').checked,t:$('rdt').value||'05:00'},k:{on:$('rk').checked,t:$('rkt').value||'09:00'}};sv('cfg',cfg);sched()};['rd','rdt','rk','rkt'].forEach(function(i){$(i).onchange=up})}
    if(dp)$('ins').onclick=function(){dp.prompt();dp=null}}
};
T.bm=function(){if(DBR){var missing=bm.filter(function(x){return !BM_VERSES[x.s+':'+x.v]});if(missing.length){Promise.all(missing.map(function(x){return DBR.getVerse(x.s,x.v)})).then(function(rows){rows.forEach(function(row){if(row)BM_VERSES[row.surah+':'+row.ayah]=row});T.bm()}).catch(function(){toast('تعذّر تحميل نصوص العلامات')});return}}var h='<p class="bookmark-hint">اضغط رقم الآية لفتح خياراتها، ثم اختر «حفظ الآية في العلامات». يمكنك تسمية العلامة وإضافة ملاحظة.</p>',L=ld('last',null);if(L)h+='<button class="res" data-go="'+L.s+','+L.v+'"><b>متابعة القراءة</b><span>سورة '+esc(S(L.s).n)+' — آية '+ad(L.v)+'</span></button>';var groups=Array.from(new Set(bm.map(function(x){return x.group||''}).filter(Boolean))),b=bm.filter(function(x){return bmFilter==='all'||(x.group||'')===bmFilter}).slice().sort(function(a,c){return c.t-a.t});h+='<label>المجموعة<select id="bm-filter"><option value="all">كل المجموعات</option>'+groups.map(function(g){return '<option value="'+ea(g)+'">'+esc(g)+'</option>'}).join('')+'</select></label>';h+=b.length?b.map(function(x){var key=x.s+':'+x.v,editing=bmEditing===key,verse=BM_VERSES[key]||(S(x.s).v[x.v-1]||{});return '<article class="bookmark-card"><div class="row"><button class="res" style="margin:0" data-go="'+x.s+','+x.v+'"><b>'+(x.title?esc(x.title):'سورة '+esc(S(x.s).n)+' — آية '+ad(x.v))+'</b><span>'+esc((verse.text||verse.e||'').slice(0,70))+(x.note?'<br>'+esc(x.note):'')+'</span></button><button data-bmedit="'+key+'" aria-label="تعديل اسم وملاحظة العلامة">✎</button><button data-del="'+x.s+','+x.v+'" aria-label="حذف العلامة">✕</button></div>'+(editing?'<div class="bookmark-edit"><label>اسم العلامة<input id="bmt" maxlength="60" value="'+ea(x.title||'')+'" placeholder="مثال: مراجعة"></label><label>ملاحظة<textarea id="bmn" maxlength="300" placeholder="ملاحظة اختيارية">'+esc(x.note||'')+'</textarea></label><label>المجموعة<input id="bmg" maxlength="40" value="'+ea(x.group||'')+'" placeholder="مثال: حفظ، تدبر"></label><button id="bmsave">حفظ</button><button id="bmcancel">إلغاء</button></div>':'')+'</article>'}).join(''):'<p>لا توجد علامات محفوظة بعد.</p>';pb.innerHTML=h;var filter=$('bm-filter');if(filter){filter.value=bmFilter;filter.onchange=function(){bmFilter=this.value;T.bm()}}var save=$('bmsave');if(save)save.onclick=function(){var p=bmEditing.split(':'),s=+p[0],v=+p[1];bm=bm.map(function(x){return x.s===s&&x.v===v?Object.assign({},x,{title:$('bmt').value.trim().slice(0,60),note:$('bmn').value.trim().slice(0,300),group:$('bmg').value.trim().slice(0,40)}):x});sv('bm',bm);bmEditing='';T.bm()};var cancel=$('bmcancel');if(cancel)cancel.onclick=function(){bmEditing='';T.bm()}};
T.words=function(){var rows=filteredWords(),items=rows.map(function(x){return x.item}),due=C.dueStudyWords(items,Date.now()),h=words.length?'':'<p class="empty-state">لم تحفظ كلمات للمراجعة بعد. افتح معنى كلمة من المصحف واضغط «أضف إلى دفتر المفردات».</p>';if(words.length)h='<div class="study-filters"><label>الكتاب<select id="wf-source"><option value="all">كل الكتب</option><option value="siraj">السراج</option><option value="muyassar">الميسّر</option></select></label><label>السورة<select id="wf-surah"><option value="all">كل السور</option>'+D.map(function(s,i){return '<option value="'+(i+1)+'">'+esc(s.n)+'</option>'}).join('')+'</select></label></div>';if(due.length)h+='<div class="review-banner"><b>حان موعد مراجعة '+ad(due.length)+' كلمة</b><button id="review-start">بطاقات المراجعة</button><button id="review-quiz">اختبار المعاني</button></div>';else if(items.length)h+='<div class="review-banner quiet">لا توجد كلمات مستحقة الآن. ستظهر الكلمات مجددًا في موعد مراجعتها.</div>';else if(words.length)h+='<p class="empty-state">لا توجد كلمات مطابقة للتصفية.</p>';rows.slice().reverse().forEach(function(row){var x=row.item,ix=row.index,source=Sources.get(x.sourceId),dueNow=!Number.isFinite(x.nextReviewAt)||x.nextReviewAt<=Date.now(),status=dueNow?'حان موعد المراجعة':'المراجعة التالية '+new Date(x.nextReviewAt).toLocaleDateString('ar'),wi=Number.isInteger(x.wordIndex)?x.wordIndex:'';h+='<article class="word-row"><button class="res" data-go="'+x.s+','+x.v+'" data-widx="'+wi+'" data-source="'+ea(x.sourceId||'siraj')+'"><b>'+esc(x.term)+'</b><span>'+esc(x.meaning)+'</span><small class="source-label">'+esc(Sources.label(x.sourceId))+(x.reference?' · '+x.reference:source&&source.editionNote?' · '+source.editionNote:'')+' · سورة '+esc(S(x.s).n)+' · آية '+ad(x.v)+' · '+status+'</small></button><button data-wdel="'+ix+'" aria-label="إزالة '+esc(x.term)+' من دفتر المفردات">✕</button></article>'});pb.innerHTML=h;var sourceSel=$('wf-source'),surahSel=$('wf-surah');if(sourceSel){sourceSel.value=wordFilter.source;sourceSel.onchange=function(){wordFilter.source=this.value;T.words()}}if(surahSel){surahSel.value=wordFilter.surah;surahSel.onchange=function(){wordFilter.surah=this.value;T.words()}}var start=$('review-start'),quiz=$('review-quiz');if(start)start.onclick=function(){beginReview('cards')};if(quiz)quiz.onclick=function(){beginReview('quiz')}};
function ac(){document.documentElement.style.setProperty('--fs',cfg.fs+'rem');view.classList.toggle('flow',!cfg.inl);sv('cfg',cfg)}
var searchRequest=0;
function paintSearchResults(r,ts,out){var n=r.filter(function(x){return x[2]==='آية'}).length,re=rx(ts);out.innerHTML=r.length?r.map(function(x){var note=x[2]==='معنى'?Sources.label(x[4])+(x[5]?' · '+x[5]:''):'';return '<button class="res" data-go="'+x[0]+','+x[1]+'"><b>'+esc(S(x[0]).n)+' '+ad(x[1])+'</b><i>'+x[2]+'</i><span>'+hl(x[3],re)+'</span>'+(note?'<small class="source-label">'+esc(note)+'</small>':'')+'</button>'}).join('')+(n>=80||r.length-n>=80?'<p>عُرضت أولى النتائج، ضيّق البحث للمزيد.</p>':''):'<p>لا توجد نتائج.</p>'}
function find(q,sc,out){
  var ts=C.searchTerms(q),request=++searchRequest;if(!ts.length){out.innerHTML='';return}
  var filters={surah:$('q-surah')&&$('q-surah').value,juz:$('q-juz')&&$('q-juz').value,page:$('q-page')&&$('q-page').value};
  if(window.SirajSearch){var scope=cfg.books[0]==='quran'||sc==='q'?'quran':sc==='m'?'meaning':'all',sourceId=cfg.books[0]==='quran'?undefined:cfg.books[0];window.SirajSearch.search(q,{scope:scope,sourceId:sourceId,surah:filters.surah==='all'?undefined:filters.surah,juz:filters.juz==='all'?undefined:filters.juz,page:filters.page||undefined,limit:80}).then(function(r){if(request===searchRequest)paintSearchResults(r,ts,out)}).catch(function(){if(request!==searchRequest)return;var fallback=cfg.books[0]==='quran'?(sc==='m'?[]:C.search(D,IX,q,'q',80,filters)):C.search(D,IX,q,sc,80,filters);paintSearchResults(fallback,ts,out)});return}
  var r=cfg.books[0]==='quran'?(sc==='m'?[]:C.search(D,IX,q,'q',80,filters)):C.search(D,IX,q,sc,80,filters);paintSearchResults(r,ts,out);
}
$('pb').addEventListener('click',function(e){
  var ed=e.target.closest('[data-bmedit]'),g=e.target.closest('[data-go]'),d=e.target.closest('[data-del]'),wd=e.target.closest('[data-wdel]');
  if(ed){bmEditing=ed.getAttribute('data-bmedit');T.bm()}
  else if(g){var p=g.getAttribute('data-go').split(','),wi=g.getAttribute('data-widx'),src=g.getAttribute('data-source');if(src)goStudyWord(+p[0],+p[1],wi!==null&&wi!==undefined&&wi!==''?+wi:undefined,src);else go(+p[0],+p[1],wi!==null&&wi!==undefined&&wi!==''?+wi:undefined)}
  else if(d){var q=d.getAttribute('data-del').split(',');tgl(+q[0],+q[1]);T.bm()}
  else if(wd){var previous=words;words=words.filter(function(_,i){return i!==+wd.getAttribute('data-wdel')});if(!sv('words',words)){words=previous;toast('تعذّر تحديث دفتر المفردات')}T.words()}
});
$('tabs').addEventListener('click',function(e){var b=e.target.closest('[data-t]');if(b)tab(b.getAttribute('data-t'))});
$('mn').onclick=function(){openP('sur')};$('sr').onclick=function(){openP('q')};$('th').onclick=tt;$('ov').onclick=closeP;
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeP()});
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();dp=e});
/* search highlighting: letters match across hamza/ya/ta-marbuta variants and ignore diacritics */
var EQ={'ا':'[اأإآٱ]','أ':'[اأإآٱ]','إ':'[اأإآٱ]','آ':'[اأإآٱ]','ٱ':'[اأإآٱ]','ى':'[يىئ]','ي':'[يىئ]','ئ':'[يىئ]','ة':'[هة]','ه':'[هة]','ؤ':'[وؤ]','و':'[وؤ]'},DC='[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]*';
function rx(ts){var p=ts.map(function(t){return Array.from(t).filter(function(c){return c!=='ء'}).map(function(c){return (EQ[c]||c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))+DC}).join('')}).filter(Boolean);return new RegExp(p.length?p.join('|'):'$^','g')}
function hl(t,re){return esc(t.replace(re,function(m){return '\u0001'+m+'\u0002'})).replace(/\u0001/g,'<em>').replace(/\u0002/g,'</em>')}
function toast(t){var d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},6000)}
/* Android (Capacitor): hardware back button */
var CA=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
if(CA&&CA.addListener)CA.addListener('backButton',function(){if($('panel').classList.contains('open'))closeP();else if(pop.style.display==='block')hidePop();else if(!$('player').hidden){au.pause();$('player').hidden=true}else CA.exitApp()});
/* the font is private-use glyphs: hide text until it loads (no tofu boxes while font-display:swap falls back) */
var de=document.documentElement;function fr(){de.classList.remove('nf')}
if(document.fonts&&document.fonts.load)document.fonts.load('1em HafsSmart','\ue95a').then(fr,fr);else fr();
setTimeout(fr,3000);
/* init */
bm=C.validBookmarks(ld('bm',[]),D);words=C.validStudyWords(ld('words',[]),D,Object.keys(Sources.catalog));var storedCfg=ld('cfg',null);cfg=C.sanitizeSettings(storedCfg||cfg,Object.keys(Sources.catalog));if(!storedCfg||storedCfg.prefsVersion!==2){cfg.books=['quran'];cfg.prefsVersion=2;sv('cfg',cfg)}ac();theme(document.documentElement.dataset.theme||'light',false);wake();
var h=(location.hash||'').match(/^#(\d+)(?::(\d+))?$/),L=ld('last',null);
var initial=function(){if(h)go(+h[1],+h[2]||1);else if(L&&L.s)go(L.s,L.v);else go(1,1);if(location.hash==='#q')openP('q')};if(cfg.books.indexOf('muyassar')>=0)loadMuyassar(initial);else initial();
if('serviceWorker' in navigator&&!window.Capacitor){var registerSW=function(){navigator.serviceWorker.register('sw.js').then(function(r){r.addEventListener('updatefound',function(){var n=r.installing;if(n)n.addEventListener('statechange',function(){if(n.state==='installed'&&navigator.serviceWorker.controller)toast('تم تنزيل تحديث؛ أعد فتح التطبيق لتفعيله')})})}).catch(function(){})};if(document.readyState==='complete')registerSW();else window.addEventListener('load',registerSW,{once:true})}
})();
