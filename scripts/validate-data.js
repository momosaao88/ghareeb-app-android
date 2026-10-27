#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const PHASE2_DATA_SHA256 = 'CEE579E53DFADD0C45644DC47D78C55CEF23CC459BCE3FF960A3B803125B856A';
const EXPECTED_VERSES = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const SURAH_ORDER = 'الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس'.split('|');
function validateData(data) {
  const errors = [], warnings = [];
  const issue = (message) => errors.push(message);
  if (!Array.isArray(data)) return { errors: ['الجذر ليس مصفوفة سور'], warnings, surahs: 0, verses: 0 };
  if (data.length !== 114) issue(`عدد السور ${data.length}؛ المتوقع 114`);
  let verses = 0, previousPage = 0, previousJuz = 0; const pages = new Set(), juz = new Set();
  data.forEach((surah, si) => {
    const sn = si + 1;
    if (!surah || typeof surah !== 'object') { issue(`السورة ${sn}: سجل غير صالح`); return; }
    if (typeof surah.n !== 'string' || !surah.n.trim()) issue(`السورة ${sn}: الاسم مفقود`);
    else if (SURAH_ORDER[si] && require('./core').normalize(surah.n) !== require('./core').normalize(SURAH_ORDER[si])) issue(`السورة ${sn}: ترتيب/اسم السورة لا يطابق فهرس الترتيب المتوقع`);
    if (!Array.isArray(surah.v)) { issue(`السورة ${sn}: قائمة الآيات مفقودة`); return; }
    if (EXPECTED_VERSES[si] !== undefined && surah.v.length !== EXPECTED_VERSES[si]) issue(`السورة ${sn}: ${surah.v.length} آية؛ المتوقع ${EXPECTED_VERSES[si]}`);
    verses += surah.v.length;
    surah.v.forEach((v, vi) => {
      const vn = vi + 1, where = `السورة ${sn} الآية ${vn}`;
      if (!v || typeof v !== 'object') { issue(`${where}: سجل غير صالح`); return; }
      for (const key of ['w','m','p','j','e']) if (!(key in v)) issue(`${where}: الحقل ${key} مفقود`);
      if (!Array.isArray(v.w) || !v.w.length || v.w.some(x => typeof x !== 'string' || !x)) issue(`${where}: كلمات العرض غير صالحة`);
      if (typeof v.m !== 'string' || !v.m) issue(`${where}: علامة نهاية الآية غير صالحة`);
      if (typeof v.e !== 'string' || !v.e.trim()) issue(`${where}: النص البحثي مفقود`);
      if (!Number.isInteger(v.p) || v.p < 1 || v.p > 604) issue(`${where}: رقم الصفحة خارج 1–604`); else { if (v.p < previousPage) issue(`${where}: ترتيب الصفحات يتراجع`); previousPage = v.p; pages.add(v.p); }
      if (!Number.isInteger(v.j) || v.j < 1 || v.j > 30) issue(`${where}: رقم الجزء خارج 1–30`); else { if (v.j < previousJuz) issue(`${where}: ترتيب الأجزاء يتراجع`); previousJuz = v.j; juz.add(v.j); }
      if (v.k !== undefined && !Array.isArray(v.k)) issue(`${where}: ربط الكلمات k ليس مصفوفة`);
      if (v.x !== undefined && !Array.isArray(v.x)) issue(`${where}: المعاني x ليست مصفوفة`);
      const meanings = Array.isArray(v.x) ? v.x : [], words = Array.isArray(v.w) ? v.w : [];
      let end = 0;
      (Array.isArray(v.k) ? v.k : []).forEach((k, ki) => {
        if (!Array.isArray(k) || k.length < 3) { issue(`${where}: ربط ${ki + 1} غير صالح`); return; }
        const [start, stop, refs] = k;
        if (!Number.isInteger(start) || !Number.isInteger(stop) || start < end || stop <= start || stop > words.length) issue(`${where}: نطاق ربط الكلمات ${ki + 1} غير صالح`);
        if (Number.isInteger(stop) && stop > end) end = stop;
        if (!Array.isArray(refs) || !refs.length || refs.some(r => !Number.isInteger(r) || r < 0 || r >= meanings.length)) issue(`${where}: مراجع المعاني في الربط ${ki + 1} غير صالحة`);
      });
      meanings.forEach((entry, mi) => {
        if (!Array.isArray(entry) || entry.length < 2 || entry.some(x => typeof x !== 'string' || !x.trim())) issue(`${where}: المعنى ${mi + 1} ناقص`);
      });
    });
  });
  if (verses !== 6236) issue(`إجمالي الآيات ${verses}؛ المتوقع 6236`);
  for (let n = 1; n <= 604; n++) if (!pages.has(n)) issue(`لا توجد آية مرتبطة بالصفحة ${n}`);
  for (let n = 1; n <= 30; n++) if (!juz.has(n)) issue(`لا توجد آية مرتبطة بالجزء ${n}`);
  warnings.push('هذه فحوص بنيوية فقط؛ لا تقارن نص الآيات أو المعاني بمصدر مرجعي.');
  return { errors, warnings, surahs: data.length, verses };
}
function loadData(file) {
  const source = fs.readFileSync(file, 'utf8').trim();
  const match = source.match(/^window\.DATA\s*=([\s\S]*);\s*$/);
  if (!match) throw new Error('لم يُعثر على إسناد window.DATA المتوقع');
  return JSON.parse(match[1]);
}
function loadAdditionalMeanings(file) {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox.SIRAJ_ADDITIONAL_MEANINGS || sandbox.SIRAJ_MUYASSAR_MEANINGS || [];
}
function validateAdditionalMeanings(records, data, sources) {
  const errors = [], seen = new Set();
  if (!Array.isArray(records)) return { errors: ['قائمة المعاني الإضافية ليست مصفوفة'], records: 0 };
  records.forEach((item, index) => {
    const where = `المعنى الإضافي ${index + 1}`;
    if (!item || typeof item !== 'object') { errors.push(`${where}: سجل غير صالح`); return; }
    if (!Number.isInteger(item.s) || item.s < 1 || item.s > data.length) { errors.push(`${where}: رقم السورة غير صالح`); return; }
    const verses = data[item.s - 1] && data[item.s - 1].v;
    if (!Number.isInteger(item.v) || !Array.isArray(verses) || item.v < 1 || item.v > verses.length) { errors.push(`${where}: رقم الآية غير صالح`); return; }
    if (typeof item.term !== 'string' || !item.term.trim()) errors.push(`${where}: اللفظ مفقود`);
    if (typeof item.meaning !== 'string' || !item.meaning.trim()) errors.push(`${where}: المعنى مفقود`);
    if (typeof item.sourceId !== 'string' || !sources[item.sourceId]) errors.push(`${where}: مصدر غير مسجل`);
    if (item.anchor !== undefined && (!Number.isInteger(item.anchor) || item.anchor < 0 || item.anchor >= (verses[item.v - 1].x || []).length)) errors.push(`${where}: ربط اللفظ بمعنى الآية غير صالح`);
    if ((item.wordStart === undefined) !== (item.wordEnd === undefined)) errors.push(`${where}: نطاق الكلمة غير مكتمل`);
    if (item.wordStart !== undefined && (!Number.isInteger(item.wordStart) || !Number.isInteger(item.wordEnd) || item.wordStart < 0 || item.wordEnd <= item.wordStart || item.wordEnd > (verses[item.v - 1].w || []).length)) errors.push(`${where}: نطاق موضع الكلمة غير صالح`);
    if (item.reference !== undefined && typeof item.reference !== 'string') errors.push(`${where}: المرجع يجب أن يكون نصًا`);
    if (typeof item.term === 'string' && typeof item.sourceId === 'string') {
      const key = [item.s, item.v, item.sourceId, item.term.trim(), item.meaning.trim()].join(':');
      if (seen.has(key)) errors.push(`${where}: سجل مكرر للمصدر والموضع واللفظ`);
      seen.add(key);
    }
  });
  return { errors, records: records.length };
}
if (require.main === module) {
  const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data.js'));
  try {
    const defaultFile = path.resolve(path.join(__dirname, '..', 'data.js'));
    const result = validateData(loadData(file));
    const sources = require('./sources.js');
    const additionalPath = path.resolve(process.argv[3] || path.join(__dirname, 'additional-meanings.js'));
    const extra = validateAdditionalMeanings(loadAdditionalMeanings(additionalPath), loadData(file), sources.catalog);
    const officialPath = path.join(__dirname, 'muyassar-meanings.js');
    const official = fs.existsSync(officialPath) ? validateAdditionalMeanings(loadAdditionalMeanings(officialPath), loadData(file), sources.catalog) : { errors: [], records: 0 };
    if (path.resolve(file) === defaultFile) {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
      console.log(`بصمة data.js: ${hash === PHASE2_DATA_SHA256 ? 'مطابقة لنسخة المرحلة الثانية' : 'مختلفة عن نسخة المرحلة الثانية'}`);
      if (hash !== PHASE2_DATA_SHA256) result.errors.push('بصمة data.js تغيرت عن خط الأساس المحفوظ؛ يلزم مراجعة يدوية قبل اعتمادها');
    }
    console.log(`فحص بنيوي: ${result.surahs} سورة، ${result.verses} آية`);
    result.warnings.forEach(x => console.log(`تنبيه: ${x}`));
    result.errors.forEach(x => console.error(`خطأ: ${x}`));
    extra.errors.forEach(x => console.error(`خطأ بيانات مصادر إضافية: ${x}`));
    console.log(`فحص مصادر المعاني الإضافية: ${extra.records} سجل`);
    official.errors.forEach(x => console.error(`خطأ في حزمة الميسّر: ${x}`));
    console.log(`فحص حزمة الميسّر: ${official.records} سجل${official.errors.length ? `، ${official.errors.length} خطأ` : '، دون أخطاء بنيوية'}`);
    console.log(result.errors.length ? `النتيجة: فشل (${result.errors.length} مشكلة)` : 'النتيجة: نجاح بنيوي');
    process.exitCode = result.errors.length || extra.errors.length || official.errors.length ? 1 : 0;
  } catch (error) { console.error(`تعذر فحص الملف: ${error.message}`); process.exitCode = 2; }
}
module.exports = { validateData, loadData, loadAdditionalMeanings, validateAdditionalMeanings, PHASE2_DATA_SHA256 };
