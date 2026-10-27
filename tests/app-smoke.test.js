'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function startApp(storage, hash = '#q', options = {}) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, innerHTML: '', textContent: '', value: '', hidden: false, dataset: { v: String((id.match(/^v(\d+)$/) || [])[1] || '') },
      style: { display: '' }, listeners: {}, classList: {
        add() {}, remove() {}, toggle() {}, contains() { return false; }
      },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      focus() {}, scrollIntoView() {}, setAttribute(name,value){this[name]=value}, getAttribute(name){return this[name]??null}, hasAttribute(name){return this[name]!==undefined},
      querySelector(selector) { return this.id === 'view' && selector.indexOf('data-word') >= 0 ? { focus() {}, scrollIntoView() {} } : null; }
    });
    return elements.get(id);
  }
  const document = {
    documentElement: { dataset: { theme: 'light' }, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} } },
    fonts: { load: () => Promise.resolve() },
    getElementById: element,
    querySelector: () => ({ content: '' }),
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => ({ className: '', remove() {}, set textContent(value) { if (options.onToast) options.onToast(value); } }),
    body: { appendChild() {} }
  };
  const audioInstances = [];
  const context = {
    document, localStorage: storage, location: { hash }, navigator: {},
    confirm: () => options.confirmResult !== false,
    FileReader: class { readAsText(value) { this.result = value; this.onload(); } },
    addEventListener() {},
    setTimeout: (fn, ms) => ms >= 1000 ? 1 : setTimeout(fn, ms), clearTimeout,
    scrollTo() {}, console, Promise, Date, Math,
    URL: { createObjectURL: value => { if (options.onObjectUrl) options.onObjectUrl(value); return 'blob:cached-audio'; }, revokeObjectURL() {} },
    indexedDB: options.indexedDB,
    AbortController: options.AbortController || AbortController,
    fetch: options.fetch || fetch,
    Audio: class { constructor() { this.paused = true; this._u = null; this.src = ''; audioInstances.push(this); } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'scripts/sources.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'scripts/additional-meanings.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'scripts/core.js'), 'utf8'), context);
  if (options.withMuyassar) vm.runInContext(fs.readFileSync(path.join(root, 'scripts/muyassar-meanings.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  return { context, element, audioInstances };
}

function fakeIndexedDB(initial) {
  const records = new Map(Object.entries(initial || {}));
  const db = {
    createObjectStore() {},
    transaction() {
      const tx = { objectStore: () => ({
        get(key) { const request = { result: records.get(key) }; queueMicrotask(() => request.onsuccess && request.onsuccess()); return request; },
        put(value, key) { records.set(key, value); queueMicrotask(() => tx.oncomplete && tx.oncomplete()); },
        clear() { records.clear(); queueMicrotask(() => tx.oncomplete && tx.oncomplete()); },
        getAllKeys() { const request={result:Array.from(records.keys())};queueMicrotask(()=>request.onsuccess&&request.onsuccess());return request; },
        getAll() { const request={result:Array.from(records.values())};queueMicrotask(()=>request.onsuccess&&request.onsuccess());return request; },
        delete(key) { records.delete(key);queueMicrotask(()=>tx.oncomplete&&tx.oncomplete()); }
      }) };
      return tx;
    }
  };
  return { open() { const request = { result: db }; queueMicrotask(() => { request.onupgradeneeded && request.onupgradeneeded(); request.onsuccess && request.onsuccess(); }); return request; } };
}

test('منطق واجهة التطبيق داخل DOM محاكى: بحث وتنقل وحفظ موضع وعلامة وإعداد', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element } = startApp(storage);
  const input = element('qi'); input.value = 'الحمد'; input.oninput();
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.match(element('qr').innerHTML, /آية/);
  assert.match(element('qr').innerHTML, /<em>/);

  const pb = element('pb');
  pb.listeners.click({ target: { closest: selector => selector === '[data-go]' ? { getAttribute: () => '1,2' } : null } });
  assert.deepEqual(JSON.parse(values.get('last')), { s: 1, v: 2 });
  assert.match(element('view').innerHTML, /id="v2"/);

  const verse = element('v2');
  element('view').listeners.click({ target: {
    closest(selector) { return selector === '[data-n]' ? { closest: () => verse } : null; }
  }, stopPropagation() {} });
  element('sheet').listeners.click({ target: {
    closest: selector => selector === '[data-a]' ? { dataset: { a: 'bm' } } : null
  }, stopPropagation() {} });
  assert.deepEqual(JSON.parse(values.get('bm')), [{ s: 1, v: 2, t: JSON.parse(values.get('bm'))[0].t, title: '', note: '' }]);

  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'set' } : null } });
  assert.match(element('pb').innerHTML, /تصدير النسخة/);
  assert.match(element('pb').innerHTML, /استعادة نسخة/);
  element('fs').value = '2.1'; element('fs').oninput();
  assert.equal(JSON.parse(values.get('cfg')).fs, 2.1);

  const resumed = startApp(storage, '');
  assert.match(resumed.element('view').innerHTML, /id="v2"/);
  assert.match(resumed.element('ttl').textContent, /الفَاتِحة/);
});

test('واجهة اختيار الصفحات والأجزاء تنتقل إلى الموضع الصحيح وترفض رقم الصفحة غير الموجود', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element, context } = startApp(storage, '');
  const chooseTab = name => element('tabs').listeners.click({ target: {
    closest: selector => selector === '[data-t]' ? { getAttribute: () => name } : null
  } });
  const clickDestination = target => element('pb').listeners.click({ target: {
    closest: selector => selector === '[data-go]' ? { getAttribute: () => target } : null
  } });

  chooseTab('pag');
  element('pn').value = '604';
  element('pgo').onclick();
  assert.deepEqual(JSON.parse(values.get('last')), { s: 112, v: 1 });
  assert.ok(element('view').innerHTML.includes('سورة ' + context.DATA[111].n));

  chooseTab('pag');
  element('pn').value = '605';
  element('pgo').onclick();
  assert.match(element('pm').textContent, /غير صحيح/);

  chooseTab('juz');
  clickDestination('78,1');
  assert.deepEqual(JSON.parse(values.get('last')), { s: 78, v: 1 });
  assert.ok(element('view').innerHTML.includes('سورة ' + context.DATA[77].n));
});

test('خيار المصحف فقط يخفي الشروح والتظليل ويقصر البحث على الآيات', async () => {
  const values = new Map([['cfg', JSON.stringify({ books: ['quran'] })]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element } = startApp(storage, '');
  assert.match(element('ttl').textContent, /المصحف فقط/);
  assert.doesNotMatch(element('view').innerHTML, /class="gl"|class="src-siraj|class="src-muyassar/);
  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'q' } : null } });
  assert.match(element('pb').innerHTML, /value="q"/); assert.doesNotMatch(element('pb').innerHTML, /معاني الغريب فقط/);
  element('qi').value = 'الحمد'; element('qs').value = 'q'; element('qi').oninput();
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.match(element('qr').innerHTML, /آية/); assert.doesNotMatch(element('qr').innerHTML, /معنى/);
});

test('المصحف فقط هو الافتراضي ويظل اختيار الكتاب الصريح محفوظًا', () => {
  const storageFor = seed => { const values = new Map(seed || []); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
  const fresh = storageFor(); startApp(fresh, '');
  assert.deepEqual(JSON.parse(fresh.values.get('cfg')).books, ['quran']);
  const legacy = storageFor([['cfg', JSON.stringify({ books: ['siraj'] })]]); startApp(legacy, '');
  assert.deepEqual(JSON.parse(legacy.values.get('cfg')).books, ['quran']);
  const chosen = storageFor([['cfg', JSON.stringify({ books: ['siraj'], prefsVersion: 2 })]]); startApp(chosen, '');
  assert.deepEqual(JSON.parse(chosen.values.get('cfg')).books, ['siraj']);
});

test('خيارات الآية تعرض إجراءً واضحًا لحفظ العلامة دون زر مكرر بجوار كل آية', () => {
  const values = new Map(); const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element } = startApp(storage, ''); const verse = element('v1');
  assert.doesNotMatch(element('view').innerHTML, /bm-toggle/);
  element('view').listeners.click({ target: { closest: selector => selector === '[data-n]' ? { closest: () => verse } : null }, stopPropagation() {} });
  assert.match(element('sheet').innerHTML, /bookmark-action/); assert.match(element('sheet').innerHTML, /حفظ الآية في العلامات/);
  element('sheet').listeners.click({ target: { closest: selector => selector === '[data-a]' ? { dataset: { a: 'bm' } } : null }, stopPropagation() {} });
  assert.deepEqual(JSON.parse(values.get('bm')).map(({s,v,title,note})=>({s,v,title,note})), [{s:1,v:1,title:'',note:''}]);
  assert.ok(element('v1').classList.toggle);
});

test('العلامات تحفظ اسمًا وملاحظة وتعيد عرضهما بعد التحرير', () => {
  const values = new Map([['bm', JSON.stringify([{ s: 1, v: 2, t: 10, title: '', note: '' }])]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element } = startApp(storage, '');
  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'bm' } : null } });
  element('pb').listeners.click({ target: { closest: selector => selector === '[data-bmedit]' ? { getAttribute: () => '1:2' } : null } });
  element('bmt').value = 'مراجعة'; element('bmn').value = 'تدبر الآية'; element('bmg').value = 'تدبر'; element('bmsave').onclick();
  assert.deepEqual(JSON.parse(values.get('bm'))[0], { s: 1, v: 2, t: 10, title: 'مراجعة', note: 'تدبر الآية', group: 'تدبر' });
  assert.match(element('pb').innerHTML, /مراجعة/); assert.match(element('pb').innerHTML, /تدبر الآية/);
});

test('دفتر المفردات يصفّي حسب الكتاب النشط والسورة دون حذف السجلات الأخرى', () => {
  const words = [
    { s: 1, v: 1, term: 'لفظ السراج', meaning: 'شرح أ', sourceId: 'siraj' },
    { s: 2, v: 3, term: 'لفظ الميسّر', meaning: 'شرح ب', sourceId: 'muyassar' }
  ];
  const values = new Map([['words', JSON.stringify(words)]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element } = startApp(storage, '');
  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'words' } : null } });
  element('wf-source').value = 'muyassar'; element('wf-source').onchange();
  assert.match(element('pb').innerHTML, /لفظ الميسّر/); assert.doesNotMatch(element('pb').innerHTML, /لفظ السراج/);
  element('wf-surah').value = '1'; element('wf-surah').onchange();
  assert.match(element('pb').innerHTML, /لا توجد كلمات مطابقة/);
  assert.equal(JSON.parse(values.get('words')).length, 2);
});

test('استيراد النسخة الاحتياطية من الواجهة يستعيد البيانات بعد التأكيد', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element, context } = startApp(storage, '');
  const backup = context.SirajCore.createBackup({ last: { s: 2, v: 3 }, bookmarks: [{ s: 1, v: 2, t: 10 }],
    settings: { fs: 1.9 }, theme: 'dark', words: [{ s: 1, v: 1, term: 'لفظ', meaning: 'شرح', sourceId: 'siraj' }] });
  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'set' } : null } });
  const picker = element('backup-file'); picker.files = [JSON.stringify(backup)]; picker.onchange.call(picker);
  assert.deepEqual(JSON.parse(values.get('last')), { s: 2, v: 3 });
  assert.deepEqual(JSON.parse(values.get('bm')), [{ s: 1, v: 2, t: 10, title: '', note: '', group: '' }]);
  assert.equal(JSON.parse(values.get('theme')), 'dark');
  assert.equal(JSON.parse(values.get('words')).length, 1);
  assert.match(element('view').innerHTML, /id="v3"/);
});

test('فشل التخزين أثناء الاستعادة يعيد القيم السابقة ولا يعتمد النسخة جزئيًا', () => {
  const values = new Map([['last', JSON.stringify({ s: 1, v: 1 })], ['bm', '[]'], ['words', '[]']]);
  let failWords = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) {
    if (failWords && key === 'words') throw Error('quota');
    values.set(key, value);
  } };
  const toasts = [];
  const { element, context } = startApp(storage, '', { onToast: message => toasts.push(message) });
  const before = new Map(values);
  const backup = context.SirajCore.createBackup({ last: { s: 2, v: 3 }, bookmarks: [{ s: 1, v: 2, t: 10 }],
    settings: { fs: 1.9 }, theme: 'dark', words: [] });
  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'set' } : null } });
  failWords = true;
  const picker = element('backup-file'); picker.files = [JSON.stringify(backup)]; picker.onchange.call(picker);
  assert.deepEqual(values, before);
  assert.ok(toasts.some(message => /تعذّرت استعادة النسخة/.test(message)));
});

test('واجهة دفتر المفردات تحفظ المصدر والموضع وتتيح إزالة الكلمة', () => {
  const values = new Map([['cfg', JSON.stringify({ books: ['siraj'], prefsVersion: 2 })]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element } = startApp(storage, '');
  const verse = element('v2');
  element('view').listeners.click({ target: {
    closest(selector) { return selector === 'mark' ? { getAttribute: name => name === 'data-word' ? '2' : '0', closest: () => verse } : null; }
  }, stopPropagation() {} });
  element('sheet').listeners.click({ target: {
    closest: selector => selector === '[data-a]' ? { dataset: { a: 'word', i: '0' } } : null
  }, stopPropagation() {} });
  const saved = JSON.parse(values.get('words'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].s, 1); assert.equal(saved[0].v, 2); assert.equal(saved[0].sourceId, 'siraj');

  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'words' } : null } });
  assert.match(element('pb').innerHTML, /دفتر المفردات/);
  assert.match(element('pb').innerHTML, /السراج في بيان غريب القرآن/);
  element('pb').listeners.click({ target: {
    closest: selector => selector === '[data-wdel]' ? { getAttribute: () => '0' } : null
  } });
  assert.deepEqual(JSON.parse(values.get('words')), []);
});

test('جلسة المراجعة تخفي المعنى حتى كشفه وتحفظ التقدم محليًا', () => {
  const values = new Map();
  const dueWord = { s: 1, v: 2, term: 'رَبِّ', meaning: 'المعنى المحفوظ', sourceId: 'siraj' };
  values.set('words', JSON.stringify([dueWord]));
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element } = startApp(storage, '');
  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'words' } : null } });
  element('review-start').onclick();
  assert.match(element('pb').innerHTML, /رَبِّ/);
  assert.doesNotMatch(element('pb').innerHTML, /المعنى المحفوظ/);
  element('review-reveal').onclick();
  assert.match(element('pb').innerHTML, /المعنى المحفوظ/);
  element('review-known').onclick();
  const saved = JSON.parse(values.get('words'))[0];
  assert.equal(saved.reviewStep, 1); assert.equal(saved.reviewCount, 1);
  assert.ok(saved.nextReviewAt > Date.now());
  assert.match(element('pb').innerHTML, /انتهت مراجعة اليوم/);
});

test('مشغل الصوت يختار ملف السورة المحفوظ محليًا عند انقطاع الشبكة', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let usedStoredBlob = false;
  const { element, audioInstances } = startApp(storage, '', {
    indexedDB: fakeIndexedDB({ 'h/001001': { savedOffline: true } }),
    onObjectUrl: blob => { usedStoredBlob = !!blob.savedOffline; }
  });
  element('au').onclick();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(usedStoredBlob, true);
  assert.equal(audioInstances[0].src, 'blob:cached-audio');
  assert.equal(element('player').hidden, false);
});

test('مشغل الصوت يدعم تكرار الآية ويمكن تعطيل متابعة تمرير القراءة', async () => {
  const values = new Map(); const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element, audioInstances } = startApp(storage, '');
  element('pl-loop').onclick.call(element('pl-loop'));
  assert.equal(audioInstances[0].loop, true);
  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'set' } : null } });
  element('af').checked = false; element('af').onchange();
  assert.equal(JSON.parse(values.get('cfg')).af, false);
});

test('الإعدادات تعرض عدد وحجم التلاوات المحفوظة لكل قارئ', async () => {
  const values = new Map(); const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element } = startApp(storage, '', { indexedDB: fakeIndexedDB({ 'h/001001': { size: 1048576 }, 'm/001001': { size: 524288 } }) });
  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'set' } : null } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(element('astat').textContent, /الحصري: 1 \(1\.0 MB\)/);
  assert.match(element('astat').textContent, /المنشاوي: 1 \(0\.5 MB\)/);
});

test('عند اختيار الميسّر تظهر تظليلاته وحدها ويعيد دفتر المفردات تفعيل مصدر الكلمة وموضعها', () => {
  const values = new Map([
    ['cfg', JSON.stringify({ books: ['muyassar'], prefsVersion: 2 })], ['last', JSON.stringify({ s: 2, v: 230 })],
    ['words', JSON.stringify([{ s: 2, v: 230, term: 'تَنكِحَ', meaning: 'تفسير', sourceId: 'muyassar', wordIndex: 8 }])]
  ]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { element } = startApp(storage, '', { withMuyassar: true });
  assert.match(element('view').innerHTML, /src-muyassar/); assert.doesNotMatch(element('view').innerHTML, /src-siraj/);
  element('tabs').listeners.click({ target: { closest: selector => selector === '[data-t]' ? { getAttribute: () => 'words' } : null } });
  element('pb').listeners.click({ target: { closest(selector) { return selector === '[data-go]' ? { getAttribute: key => ({ 'data-go': '2,230', 'data-widx': '8', 'data-source': 'muyassar' }[key] ?? null) } : null; } } });
  assert.deepEqual(JSON.parse(values.get('cfg')).books, ['muyassar']);
  assert.deepEqual(JSON.parse(values.get('last')), { s: 2, v: 230 });
});

test('تخزين الصوت يعيد المحاولة بعد فشل فتح IndexedDB المؤقت', async () => {
  const values = new Map(); const toasts = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const working = fakeIndexedDB({ 'h/001001': { savedOffline: true } });
  let attempts = 0;
  const flaky = { open(name, version) {
    attempts++;
    if (attempts > 1) return working.open(name, version);
    const request = { error: Error('temporary database failure') };
    queueMicrotask(() => request.onerror && request.onerror());
    return request;
  } };
  let usedStoredBlob = false;
  const { element, audioInstances } = startApp(storage, '', { indexedDB: flaky,
    onObjectUrl: blob => { usedStoredBlob = !!blob.savedOffline; }, onToast: message => toasts.push(message) });
  element('au').onclick();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(toasts.some(message => /تعذّر تشغيل الصوت/.test(message)));
  element('au').onclick();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(attempts, 2);
  assert.equal(usedStoredBlob, true);
  assert.equal(audioInstances[0].src, 'blob:cached-audio');
});

test('إيقاف تنزيل السورة يلغي طلب الشبكة الجاري ويحفظ المكتمل', async () => {
  const values = new Map(); const toasts = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let fetchStarted = false, signalAborted = false;
  class MockAbortController {
    constructor() { const handlers=[]; this.signal={aborted:false,addEventListener:(_,fn)=>handlers.push(fn)}; this.abort=()=>{this.signal.aborted=true;signalAborted=true;handlers.forEach(fn=>fn())}; }
  }
  const fetchPending = (_, options) => { fetchStarted=true;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{const error=Error('aborted');error.name='AbortError';reject(error)})); };
  const { element } = startApp(storage, '', { indexedDB: fakeIndexedDB(), AbortController: MockAbortController, fetch: fetchPending, onToast: message => toasts.push(message) });
  element('pdl').onclick();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fetchStarted, true);
  element('pdl').onclick();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(signalAborted, true);
  assert.ok(toasts.includes('أُوقف التنزيل'));
});
