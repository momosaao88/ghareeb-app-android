/* Small, dependency-free logic shared by the app and its Node tests. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.SirajCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function normalize(text) {
    return String(text).replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ي').replace(/ء/g, '');
  }
  function searchTerms(query) { return normalize(query).split(/\s+/).filter(Boolean); }
  function makeIndexes(data, additionalMeanings, sourceCatalog) {
    const pages = Object.create(null), juz = Object.create(null), verses = [], meanings = [], verseMeta = Object.create(null);
    data.forEach((surah, si) => surah.v.forEach((verse, vi) => {
      if (!pages[verse.p]) pages[verse.p] = [si + 1, vi + 1];
      if (!juz[verse.j]) juz[verse.j] = [si + 1, vi + 1];
      verseMeta[(si + 1) + ':' + (vi + 1)] = { p: +verse.p, j: +verse.j };
      verses.push([si + 1, vi + 1, normalize(verse.e)]);
      (verse.x || []).forEach(item => meanings.push([si + 1, vi + 1, normalize(item[0] + ' ' + item[1]), item[0], item[1], 'siraj', null]));
    }));
    (additionalMeanings || []).forEach(item => {
      if (!item || !Number.isInteger(+item.s) || !Number.isInteger(+item.v) ||
          !data[+item.s - 1] || !data[+item.s - 1].v[+item.v - 1] ||
          !item.term || !item.meaning || (sourceCatalog && !sourceCatalog[item.sourceId])) return;
      meanings.push([+item.s, +item.v, normalize(item.term + ' ' + item.meaning), item.term, item.meaning, item.sourceId, item.reference || null]);
    });
    return { pages, juz, verses, meanings, verseMeta };
  }
  function search(data, indexes, query, scope, limit, filters) {
    const terms = searchTerms(query);
    if (!terms.length) return [];
    limit = limit || 80;
    const matches = item => terms.every(term => item.indexOf(term) !== -1);
    const allowed = (s, v) => { const meta = indexes.verseMeta && indexes.verseMeta[s + ':' + v], f = filters || {};
      return (!f.surah || f.surah === 'all' || s === +f.surah) && (!f.juz || f.juz === 'all' || (meta && meta.j === +f.juz)) && (!f.page || f.page === 'all' || (meta && meta.p === +f.page)); };
    const result = [];
    if (scope !== 'm') for (const e of indexes.verses) {
      if (allowed(e[0],e[1]) && matches(e[2])) result.push([e[0], e[1], 'آية', data[e[0] - 1].v[e[1] - 1].e]);
      if (result.length >= limit) break;
    }
    const verseCount = result.length;
    if (scope !== 'q') for (const e of indexes.meanings) {
      if (allowed(e[0],e[1]) && matches(e[2])) result.push([e[0], e[1], 'معنى', e[3] + ' — ' + e[4], e[5], e[6]]);
      if (result.length >= verseCount + limit) break;
    }
    return result;
  }
  function destination(data, surah, verse) {
    const s = Math.max(1, Math.min(data.length, Number(surah) | 0));
    const n = data[s - 1].v.length;
    const v = Math.max(1, Math.min(n, Number(verse) | 0));
    return { s, v };
  }
  function toggleBookmark(bookmarks, s, v, time) {
    const i = bookmarks.findIndex(b => b.s == s && b.v == v);
    if (i < 0) return bookmarks.concat([{ s, v, t: time, title: '', note: '' }]);
    return bookmarks.filter((_, j) => j !== i);
  }
  function readStored(storage, key, fallback) {
    try { const value = storage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch (_) { return fallback; }
  }
  function saveStored(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }
  function studyKey(item) {
    if (!item || !Number.isInteger(+item.s) || !Number.isInteger(+item.v) || !item.term) return '';
    return [item.sourceId || 'siraj', +item.s, +item.v, normalize(item.term)].join(':');
  }
  function toggleStudyWord(items, item) {
    const key = studyKey(item);
    if (!key || typeof item.meaning !== 'string' || !item.meaning.trim()) return items;
    const exists = items.some(saved => studyKey(saved) === key);
    return exists ? items.filter(saved => studyKey(saved) !== key) : items.concat([item]);
  }
  function validStudyWords(items, data, sourceIds, now) {
    if (!Array.isArray(items)) return [];
    const allowed = new Set(sourceIds || ['siraj']), currentTime = Number.isFinite(now) ? now : Date.now();
    const seen = new Set();
    return items.filter(item => {
      const key = studyKey(item);
      if (!key || typeof item.term !== 'string' || !item.term.trim() || typeof item.meaning !== 'string' ||
          !item.meaning.trim() || !allowed.has(item.sourceId || 'siraj')) return false;
      const surah = data[+item.s - 1];
      if (+item.s < 1 || +item.s > data.length || !surah || !Array.isArray(surah.v) || +item.v < 1 || +item.v > surah.v.length || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(item => Object.assign({}, item, {
      sourceId: item.sourceId || 'siraj',
      reviewStep: Number.isInteger(item.reviewStep) ? Math.max(0, Math.min(4, item.reviewStep)) : 0,
      nextReviewAt: Number.isFinite(item.nextReviewAt) ? item.nextReviewAt : currentTime,
      reviewCount: Number.isInteger(item.reviewCount) && item.reviewCount >= 0 ? item.reviewCount : 0
    }));
  }
  const REVIEW_INTERVALS = [1, 3, 7, 14, 30], DAY_MS = 86400000;
  function dueStudyWords(items, now) {
    const currentTime = Number.isFinite(now) ? now : Date.now();
    return (items || []).filter(item => !Number.isFinite(item.nextReviewAt) || item.nextReviewAt <= currentTime)
      .slice().sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0));
  }
  function gradeStudyWord(item, remembered, now) {
    const currentTime = Number.isFinite(now) ? now : Date.now();
    const step = Number.isInteger(item.reviewStep) ? Math.max(0, Math.min(4, item.reviewStep)) : 0;
    const nextStep = remembered ? Math.min(step + 1, REVIEW_INTERVALS.length - 1) : 0;
    const delay = remembered ? REVIEW_INTERVALS[step] * DAY_MS : 10 * 60 * 1000;
    return Object.assign({}, item, { reviewStep: nextStep, nextReviewAt: currentTime + delay,
      reviewCount: (Number.isInteger(item.reviewCount) ? item.reviewCount : 0) + 1,
      lastReviewedAt: currentTime, lastReviewResult: remembered ? 'remembered' : 'again' });
  }
  function validBookmarks(items, data) {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    return items.filter(item => {
      if (!item || !Number.isInteger(+item.s) || !Number.isInteger(+item.v)) return false;
      const surah = data[+item.s - 1], key = [+item.s, +item.v].join(':');
      if (!surah || !Array.isArray(surah.v) || +item.v < 1 || +item.v > surah.v.length || seen.has(key)) return false;
      seen.add(key); return true;
    }).map(item => ({ s: +item.s, v: +item.v, t: Number.isFinite(+item.t) ? +item.t : 0,
      title: typeof item.title === 'string' ? item.title.trim().slice(0, 60) : '',
      note: typeof item.note === 'string' ? item.note.trim().slice(0, 300) : '',
      group: typeof item.group === 'string' ? item.group.trim().slice(0, 40) : '' }));
  }
  function sanitizeSettings(value, sourceIds) {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const time = (v, fallback) => typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback;
    const reminder = (r, fallback) => ({ on: !!(r && r.on), t: time(r && r.t, fallback) });
    const fs = Number(raw.fs);
    const allowed = new Set((sourceIds || ['siraj']).concat(['quran']));
    const validBooks = Array.isArray(raw.books) ? Array.from(new Set(raw.books.filter(id => allowed.has(id)))) : ['quran'];
    const books = validBooks.indexOf('quran') >= 0 ? ['quran'] : validBooks.length ? [validBooks[0]] : ['quran'];
    return {
      fs: Number.isFinite(fs) ? Math.max(1.1, Math.min(2.8, fs)) : 1.5,
      inl: typeof raw.inl === 'boolean' ? raw.inl : true,
      rc: raw.rc === 'm' ? 'm' : 'h',
      wl: raw.wl === true,
      af: raw.af !== false,
      pageMode: raw.pageMode === true,
      audioSpeed: Number.isFinite(Number(raw.audioSpeed)) ? Math.max(0.75, Math.min(1.5, Number(raw.audioSpeed))) : 1,
      repeatCount: Number.isInteger(raw.repeatCount) ? Math.max(1, Math.min(10, raw.repeatCount)) : 1,
      rm: { d: reminder(raw.rm && raw.rm.d, '05:00'), k: reminder(raw.rm && raw.rm.k, '09:00') },
      books: books.length ? books : ['quran'], prefsVersion: 2
    };
  }
  function createBackup(state, now) {
    return { format: 'siraj-user-backup', version: 1, createdAt: new Date(Number.isFinite(now) ? now : Date.now()).toISOString(), data: {
      last: state.last || null, bookmarks: state.bookmarks || [], settings: state.settings || {}, theme: state.theme || 'light', words: state.words || []
    } };
  }
  function parseBackup(input, data, sourceIds, now) {
    const errors = []; let backup;
    try { backup = typeof input === 'string' ? JSON.parse(input) : input; }
    catch (_) { return { errors: ['ملف النسخة الاحتياطية ليس JSON صالحًا'] }; }
    if (!backup || backup.format !== 'siraj-user-backup' || backup.version !== 1 || !backup.data || typeof backup.data !== 'object')
      return { errors: ['صيغة النسخة الاحتياطية أو إصدارها غير مدعوم'] };
    const saved = backup.data, last = saved.last;
    if (last !== null && (!last || !Number.isInteger(+last.s) || !Number.isInteger(+last.v) ||
        +last.s < 1 || +last.s > data.length || +last.v < 1 || +last.v > (data[+last.s - 1].v || []).length)) errors.push('موضع القراءة في النسخة غير صالح');
    if (!Array.isArray(saved.bookmarks)) errors.push('قائمة العلامات غير صالحة');
    if (!Array.isArray(saved.words)) errors.push('قائمة المفردات غير صالحة');
    if (!saved.settings || typeof saved.settings !== 'object' || Array.isArray(saved.settings)) errors.push('الإعدادات في النسخة غير صالحة');
    if (!['light', 'sepia', 'dark'].includes(saved.theme)) errors.push('السمة في النسخة غير صالحة');
    const bookmarks = validBookmarks(saved.bookmarks, data);
    if (Array.isArray(saved.bookmarks) && bookmarks.length !== saved.bookmarks.length) errors.push('توجد علامات مكررة أو مراجع آيات غير صالحة');
    const words = validStudyWords(saved.words, data, sourceIds, now);
    if (Array.isArray(saved.words) && words.length !== saved.words.length) errors.push('توجد مفردات بمصدر غير معروف أو موضع غير صالح');
    if (errors.length) return { errors };
    return { errors, data: { last: last ? { s: +last.s, v: +last.v } : null, bookmarks,
      settings: sanitizeSettings(saved.settings, sourceIds), theme: saved.theme, words } };
  }
  function filterSearchResults(results, filters, indexes) {
    const f = filters || {};
    return (results || []).filter(item => {
      const s = +item[0], v = +item[1], verse = indexes && indexes.verseMeta && indexes.verseMeta[s + ':' + v];
      return (!f.surah || f.surah === 'all' || s === +f.surah) &&
        (!f.juz || f.juz === 'all' || (verse && verse.j === +f.juz)) &&
        (!f.page || f.page === 'all' || (verse && verse.p === +f.page));
    });
  }
  function reviewQuizOptions(items, current, limit) {
    const candidates = (items || []).filter(x => x && x.meaning && studyKey(x) !== studyKey(current));
    for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
    const seen = new Set([current.meaning]), options = [current];
    for (const candidate of candidates) if (!seen.has(candidate.meaning) && options.length < Math.max(1, limit || 4)) { seen.add(candidate.meaning); options.push(candidate); }
    for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
    return options;
  }
  return { normalize, searchTerms, makeIndexes, search, destination, toggleBookmark, readStored, saveStored, studyKey, toggleStudyWord, validStudyWords, dueStudyWords, gradeStudyWord, validBookmarks, sanitizeSettings, createBackup, parseBackup, filterSearchResults, reviewQuizOptions };
});
