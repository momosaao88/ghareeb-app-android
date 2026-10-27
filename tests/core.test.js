'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../scripts/core.js');
const sources = require('../scripts/sources.js');
const { validateData, loadData, validateAdditionalMeanings, PHASE2_DATA_SHA256 } = require('../scripts/validate-data.js');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const data = loadData(path.join(root, 'data.js'));

test('بيانات المشروع تجتاز التحقق البنيوي', () => assert.deepEqual(validateData(data).errors, []));
test('بصمة ملف البيانات مطابقة لخط الأساس ولا تثبت المصدر المرجعي', () => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data.js'))).digest('hex').toUpperCase();
  assert.equal(hash, PHASE2_DATA_SHA256);
});
test('يكشف الحقول المفقودة ومراجع المعاني ونطاقات الكلمات غير الصالحة', () => {
  const fixture = [{ n: 'اختبار', v: [{ w: ['لفظ'], m: '١', p: 1, j: 1, k: [[0, 2, [1]]], x: [['لفظ', 'معنى']] }] }];
  const errors = validateData(fixture).errors.join('\n');
  assert.match(errors, /عدد السور/); assert.match(errors, /الحقل/);
  assert.match(errors, /نطاق ربط الكلمات/); assert.match(errors, /مراجع المعاني/);
});
test('التحقق من المصادر الإضافية يكشف المرجع والمصدر والربط غير الصالح', () => {
  const catalog = Object.assign({}, require('../scripts/sources').catalog, { lughat: { id: 'lughat' } });
  const good = { s: 1, v: 2, term: 'لفظ', meaning: 'شرح تجريبي', sourceId: 'lughat', anchor: 0, reference: 'ص ١٢' };
  assert.deepEqual(validateAdditionalMeanings([good], data, catalog).errors, []);
  const bad = validateAdditionalMeanings([Object.assign({}, good, { sourceId: 'unknown', anchor: 99, reference: 12 })], data, catalog).errors.join('\n');
  assert.match(bad, /مصدر غير مسجل/); assert.match(bad, /ربط اللفظ/); assert.match(bad, /المرجع/);
});
test('يبني مواضع الصفحات والأجزاء من أول آية لكل رقم', () => {
  const ix = core.makeIndexes(data);
  assert.deepEqual(ix.pages[1], [1, 1]);
  assert.deepEqual(ix.pages[604], [112, 1]);
  assert.deepEqual(ix.juz[1], [1, 1]);
  assert.equal(ix.juz[30][0], 78);
});
test('البحث يدعم الآيات والمعاني والنطاقين والتطبيع العربي', () => {
  const ix = core.makeIndexes(data);
  assert.ok(core.search(data, ix, 'الرحمن', 'q').some(r => r[0] === 1 && r[1] === 1));
  assert.ok(core.search(data, ix, 'الرب المربي', 'm').some(r => r[2] === 'معنى'));
  assert.ok(core.search(data, ix, 'رَبّ', 'a').some(r => r[2] === 'معنى'));
  assert.deepEqual(core.search(data, ix, '   ', 'a'), []);
  assert.deepEqual(core.searchTerms(''), []);
  assert.deepEqual(core.searchTerms('الْحَمْدُ للهِ'), ['الحمد', 'لله']);
});
test('المعاني الإضافية تبقى منسوبة لمصدرها وتظهر عند ربطها بلفظ محدد', () => {
  const catalog = Object.assign({}, sources.catalog, { lughat: { id: 'lughat', title: 'كتاب لغوي', author: 'مؤلف' } });
  const extra = [{ s: 1, v: 2, term: 'رب', meaning: 'مصدر إضافي للاختبار', sourceId: 'lughat', anchor: 0, reference: 'ص ١٢' }];
  const ix = core.makeIndexes(data, extra, catalog);
  const result = core.search(data, ix, 'مصدر إضافي', 'm');
  assert.deepEqual(result[0].slice(0, 3), [1, 2, 'معنى']);
  assert.equal(result[0][4], 'lughat');
  assert.equal(result[0][5], 'ص ١٢');
  assert.equal(sources.forVerse(data[0].v[1].x, extra, 1, 2, [0], catalog).length, 2);
  const unrelated = sources.forVerse(data[0].v[1].x, extra, 1, 2, [1], catalog);
  assert.equal(unrelated.length, 1);
  assert.equal(unrelated[0].sourceId, 'siraj');
});
test('كتاب الميسّر مستقل المصدر وقابل للبحث دون تغيير بيانات السراج', () => {
  const context = {}; vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/muyassar-meanings.js'), 'utf8'), context);
  const official = context.SIRAJ_MUYASSAR_MEANINGS.find(x => x.s === 2 && x.v === 230 && x.term === 'فَإِن طَلَّقَهَا' && x.meaning.includes('الزوج'));
  assert.ok(official); assert.equal(official.sourceId, 'muyassar');
  assert.equal(sources.label('muyassar'), 'الميسّر في غريب القرآن الكريم — مجمع الملك فهد لطباعة المصحف الشريف');
  const ix = core.makeIndexes(data, [official], sources.catalog);
  assert.ok(core.search(data, ix, 'الزوج الثاني', 'm').some(r => r[0] === 2 && r[1] === 230 && r[4] === 'muyassar'));
  assert.deepEqual(core.sanitizeSettings({ books: ['muyassar', 'unknown'] }, Object.keys(sources.catalog)).books, ['muyassar']);
  assert.deepEqual(data[1].v[229].x, loadData(path.join(root, 'data.js'))[1].v[229].x);
});
test('التنقل يقيد السورة والآية إلى حدود بياناتها', () => {
  assert.deepEqual(core.destination(data, 0, -2), { s: 1, v: 1 });
  assert.deepEqual(core.destination(data, 999, 999), { s: 114, v: 6 });
  assert.deepEqual(core.destination(data, 2, 287), { s: 2, v: 286 });
});
test('تبديل العلامات يضيف ويحذف العلامة المقصودة فقط', () => {
  const marked = core.toggleBookmark([], 2, 3, 10);
  assert.deepEqual(marked, [{ s: 2, v: 3, t: 10, title: '', note: '' }]);
  assert.deepEqual(core.toggleBookmark(marked, 2, 3, 11), []);
  assert.equal(core.toggleBookmark(marked, 2, 4, 12).length, 2);
});
test('قراءة الإعدادات والموضع تتحمل JSON تالفًا وفشل التخزين', () => {
  const storage = { getItem: () => '{bad', setItem: () => { throw Error('quota'); } };
  assert.deepEqual(core.readStored(storage, 'last', { s: 1, v: 1 }), { s: 1, v: 1 });
  assert.equal(core.saveStored(storage, 'cfg', {}), false);
  const memory = new Map(); const ok = { getItem: k => memory.get(k), setItem: (k,v) => memory.set(k,v) };
  const last = { s: 18, v: 1 }; assert.equal(core.saveStored(ok, 'last', last), true);
  assert.deepEqual(core.readStored(ok, 'last', null), last);
});
test('النسخة الاحتياطية قابلة للتحقق والاستعادة وترفض إصدارًا أو مصدرًا غير معروف', () => {
  const now = 1700000000000;
  const backup = core.createBackup({ last: { s: 18, v: 1 }, bookmarks: [{ s: 2, v: 3, t: now, title: 'مراجعة', note: 'تدبر', group: 'تدبر' }],
    settings: { fs: 1.8, rc: 'm', inl: false, books: ['siraj', 'muyassar'] }, theme: 'sepia',
    words: [{ s: 1, v: 1, term: 'لفظ', meaning: 'شرح', sourceId: 'siraj' }] }, now);
  const restored = core.parseBackup(JSON.stringify(backup), data, ['siraj', 'muyassar'], now);
  assert.deepEqual(restored.errors, []);
  assert.deepEqual(restored.data.last, { s: 18, v: 1 });
  assert.deepEqual(restored.data.bookmarks, [{ s: 2, v: 3, t: now, title: 'مراجعة', note: 'تدبر', group: 'تدبر' }]);
  assert.equal(restored.data.words[0].sourceId, 'siraj');
  assert.equal(restored.data.settings.rc, 'm');
  assert.deepEqual(restored.data.settings.books, ['siraj']);
  assert.match(core.parseBackup('{bad', data, ['siraj'], now).errors[0], /JSON/);
  const unknown = JSON.parse(JSON.stringify(backup)); unknown.data.words[0].sourceId = 'unknown';
  assert.match(core.parseBackup(unknown, data, ['siraj', 'muyassar'], now).errors.join(' '), /مصدر غير معروف/);
  unknown.version = 2;
  assert.match(core.parseBackup(unknown, data, ['siraj'], now).errors.join(' '), /غير مدعوم/);
});
test('دفتر المفردات يميز المصدر والموضع ويتجاهل السجلات المكررة أو غير الصالحة', () => {
  const word = { s: 1, v: 1, term: 'الرَّحْمنِ', meaning: 'المعنى', sourceId: 'siraj' };
  const added = core.toggleStudyWord([], word);
  assert.equal(added.length, 1);
  assert.equal(core.toggleStudyWord(added, Object.assign({}, word, { term: 'الرحمن' })).length, 0);
  assert.equal(core.toggleStudyWord([], { s: 1, v: 1, term: 'لفظ' }).length, 0);
  assert.equal(core.validStudyWords([word, word, { s: 999, v: 1, term: 'مفقود', meaning: 'x', sourceId: 'siraj' }], data).length, 1);
});
test('مراجعة الكلمات تؤجل الإتقان تدريجيًا وتعيد الكلمات الصعبة سريعًا', () => {
  const now = 1700000000000;
  const word = { s: 1, v: 1, term: 'لفظ', meaning: 'شرح', sourceId: 'siraj', reviewStep: 0, nextReviewAt: now, reviewCount: 0 };
  assert.deepEqual(core.dueStudyWords([word], now), [word]);
  const known = core.gradeStudyWord(word, true, now);
  assert.equal(known.nextReviewAt, now + 86400000); assert.equal(known.reviewStep, 1);
  assert.deepEqual(core.dueStudyWords([known], now), []);
  const again = core.gradeStudyWord(word, false, now);
  assert.equal(again.nextReviewAt, now + 600000); assert.equal(again.reviewStep, 0);
  assert.equal(core.dueStudyWords([again], now + 600000).length, 1);
});
test('تنظيف العلامات والإعدادات يحمي من التخزين التالف والقيم خارج الحدود', () => {
  assert.deepEqual(core.validBookmarks([{ s: 1, v: 2, t: 'x', title: 'مراجعة', note: 'تدبر' }, { s: 1, v: 2 }, { s: 999, v: 1 }], data), [{ s: 1, v: 2, t: 0, title: 'مراجعة', note: 'تدبر', group: '' }]);
  assert.deepEqual(core.sanitizeSettings({ fs: 99, inl: false, rc: 'invalid', wl: true, rm: { d: { on: true, t: '29:80' } } }), {
    fs: 2.8, inl: false, rc: 'h', wl: true, af: true, pageMode: false, audioSpeed: 1, repeatCount: 1, rm: { d: { on: true, t: '05:00' }, k: { on: false, t: '09:00' } }, books: ['quran'], prefsVersion: 2
  });
  assert.deepEqual(core.sanitizeSettings({ books: ['muyassar', 'siraj'] }, Object.keys(sources.catalog)).books, ['muyassar']);
  assert.deepEqual(core.sanitizeSettings({ books: ['quran', 'muyassar'] }, Object.keys(sources.catalog)).books, ['quran']);
});
test('فلاتر البحث تقيد النتائج بالسورة والجزء والصفحة وتولّد خيارات اختبار مميزة', () => {
  const ix = core.makeIndexes(data), all = core.search(data, ix, 'الرحمن', 'q', 200);
  assert.ok(core.filterSearchResults(all, { surah: '1' }, ix).every(x => x[0] === 1));
  assert.ok(core.filterSearchResults(all, { juz: '1' }, ix).every(x => ix.verseMeta[x[0]+':'+x[1]].j === 1));
  assert.ok(core.filterSearchResults(all, { page: '1' }, ix).every(x => ix.verseMeta[x[0]+':'+x[1]].p === 1));
  assert.ok(core.search(data, ix, 'الله', 'q', 3, { surah: '2' }).every(x => x[0] === 2));
  const current = {s:1,v:1,term:'كلمة',meaning:'الصحيح',sourceId:'siraj'}, distractors = [1,2,3].map(i=>({s:1,v:i+1,term:'لفظ'+i,meaning:'معنى'+i,sourceId:'siraj'}));
  const options=core.reviewQuizOptions([current].concat(distractors),current,4);
  assert.ok(options.some(x=>x.meaning===current.meaning)); assert.equal(new Set(options.map(x=>x.meaning)).size,options.length);
});
test('ملف الإقلاع يحمّل وحدات البيانات ويضمّنها البناء والنسخة غير المتصلة', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /var ts=C\.searchTerms\(q\)/);
  assert.match(app, /rx\(ts\)/);
  assert.match(app, /r\.filter\(function\(x\)\{return x\[2\]==='آية'\}\)\.length/);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /type="module" src="scripts\/modules\/bootstrap\.js"/);
  const bootstrap = fs.readFileSync(path.join(root, 'scripts/modules/bootstrap.js'), 'utf8');
  assert.match(bootstrap, /QuranRepository/); assert.match(bootstrap, /toLegacyMeta/);
  assert.match(fs.readFileSync(path.join(root, 'scripts/modules/quran-data.js'), 'utf8'), /createIndex\('byPage'/);
  assert.match(fs.readFileSync(path.join(root, 'scripts/build-www.js'), 'utf8'), /cpSync\(__dirname, path\.join\(out, 'scripts'\)/);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /scripts\/core\.js/); assert.match(sw, /scripts\/modules\/quran-data\.js/); assert.match(sw, /scripts\/modules\/bootstrap\.js/); assert.match(sw, /scripts\/muyassar-meanings\.js/); assert.match(sw, /siraj-v20/);
});
test('وحدات البيانات والبحث تحافظ على النص وتطبع الاستعلام العربي فقط', async () => {
  const dataModule = await import('../scripts/modules/quran-data.js');
  const searchModule = await import('../scripts/modules/search-engine.js');
  assert.deepEqual(dataModule.tokenize('إِنَّ ٱلرَّحْمَٰنَ'), ['ان', 'الرحمن']);
  assert.deepEqual(dataModule.tokenize('  '), []);
  assert.equal(typeof searchModule.createSearchEngine, 'function');
  const renderer = await import('../scripts/modules/mushaf-renderer.js');
  assert.match(renderer.wordMarkup('<لفظ>', 0), /&lt;لفظ&gt;/);
});
test('عامل الخدمة يعيد الصفحة المخزنة عند انقطاع الشبكة', async () => {
  const listeners = {}; let fallbackUsed = false;
  const fallback = { offline: true };
  const sandbox = {
    self: { addEventListener: (name, fn) => { listeners[name] = fn; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() } },
    caches: { match: async key => { if (key === 'index.html') { fallbackUsed = true; return fallback; } return undefined; }, open: async () => ({ addAll: async () => {} }), keys: async () => [] },
    fetch: async () => { throw Error('offline'); }, URL, location: { origin: 'https://example.test' }, Request,
    Response: { error: () => ({ error: true }) }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), sandbox);
  let response; listeners.fetch({ request: { method: 'GET', url: 'https://example.test/verse', mode: 'navigate' }, respondWith: p => { response = p; } });
  assert.equal(await response, fallback); assert.equal(fallbackUsed, true);
});
