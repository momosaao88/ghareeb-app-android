/* Source metadata for meanings. Content is kept in data.js; this file only labels its provenance. */
(function (root, factory) {
  const sources = factory();
  if (typeof module === 'object' && module.exports) module.exports = sources;
  else root.SirajSources = sources;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULT_ID = 'siraj';
  const catalog = Object.freeze({
    siraj: Object.freeze({
      id: 'siraj',
      title: 'السراج في بيان غريب القرآن',
      author: 'محمد بن عبد العزيز الخضيري',
      copy: 'نسخة المكتبة الشاملة كما يذكر المشروع',
      edition: null,
      editionNote: 'بيانات الطبعة غير موثقة في ملفات المشروع'
    }),
    muyassar: Object.freeze({
      id: 'muyassar', title: 'الميسّر في غريب القرآن الكريم', author: null,
      publisher: 'مجمع الملك فهد لطباعة المصحف الشريف', edition: 2,
      editionNote: 'حزمة المطورين الرسمية؛ الطبعة الثانية. مواضع 811 لفظًا تحتاج مراجعة يدوية.'
    })
  });
  function get(id) { return catalog[id] || null; }
  function forVerse(baseEntries, additional, surah, ayah, selected, availableCatalog) {
    const wanted = selected ? new Set(selected) : null;
    const available = availableCatalog || catalog;
    const base = (baseEntries || []).map((entry, index) => ({
      term: entry[0], meaning: entry[1], sourceId: DEFAULT_ID, anchor: index,
      reference: null, legacyIndex: index
    })).filter(entry => !wanted || wanted.has(entry.anchor));
    const other = (additional || []).filter(entry => entry && +entry.s === +surah && +entry.v === +ayah &&
      available[entry.sourceId] && typeof entry.term === 'string' && entry.term.trim() &&
      typeof entry.meaning === 'string' && entry.meaning.trim() &&
      (!wanted || entry.anchor === undefined || wanted.has(entry.anchor)))
      .map(entry => ({ term: entry.term, meaning: entry.meaning, sourceId: entry.sourceId,
        anchor: Number.isInteger(entry.anchor) ? entry.anchor : null,
      reference: entry.reference || null, legacyIndex: null,
      wordStart: Number.isInteger(entry.wordStart) ? entry.wordStart : null,
      wordEnd: Number.isInteger(entry.wordEnd) ? entry.wordEnd : null }));
    return base.concat(other);
  }
  function label(id) {
    const source = get(id);
    return source ? source.title + (source.author ? ' — ' + source.author : source.publisher ? ' — ' + source.publisher : '') : 'مصدر غير محدد';
  }
  return Object.freeze({ DEFAULT_ID, catalog, get, label, forVerse });
});
