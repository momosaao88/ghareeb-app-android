const DB_NAME = 'quran-road-content';
const DB_VERSION = 2;

export function normalizeArabic(value) {
  return String(value ?? '').normalize('NFC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/[ىئ]/g, 'ي').replace(/[ؤ]/g, 'و')
    .replace(/ة/g, 'ه').replace(/[ء]/g, '')
    .replace(/[^\u0621-\u064A0-9]+/g, ' ').trim();
}

export function tokenize(value) {
  return Array.from(new Set(normalizeArabic(value).split(/\s+/).filter(Boolean)));
}

function waitTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function pad(value) { return String(value).padStart(3, '0'); }
function verseId(s, a) { return `${pad(s)}:${pad(a)}`; }

export async function openQuranDB() {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('verses')) {
      const store = db.createObjectStore('verses', { keyPath: 'id' });
      store.createIndex('bySurahAyah', ['surah', 'ayah'], { unique: true });
      store.createIndex('byPage', ['page', 'surah', 'ayah']);
      store.createIndex('byJuz', ['juz', 'surah', 'ayah']);
    }
    if (!db.objectStoreNames.contains('meanings')) {
      const store = db.createObjectStore('meanings', { keyPath: 'id' });
      store.createIndex('byVerse', ['surah', 'ayah']);
      store.createIndex('bySourceVerse', ['sourceId', 'surah', 'ayah']);
    }
    const meaningStore = request.transaction.objectStore('meanings');
    if (!meaningStore.indexNames.contains('bySource')) meaningStore.createIndex('bySource', 'sourceId');
    if (!db.objectStoreNames.contains('searchDocs')) {
      const store = db.createObjectStore('searchDocs', { keyPath: 'id' });
      store.createIndex('byToken', 'tokens', { multiEntry: true });
    }
    const searchStore = request.transaction.objectStore('searchDocs');
    if (!searchStore.indexNames.contains('bySource')) searchStore.createIndex('bySource', 'sourceId');
    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
  };
  return requestValue(request);
}

function searchDocument(id, type, surah, ayah, text, extra = {}) {
  return { id, type, surah, ayah, text, tokens: tokenize(text), ...extra };
}

function sirajMeanings(verse, surah, ayah) {
  const entries = (verse.x || []).map((entry, index) => ({
    sourceId: 'siraj', surah, ayah, ordinal: index, term: entry[0], meaning: entry[1],
    reference: null, wordStart: null, wordEnd: null
  }));
  (verse.k || []).forEach(([start, end, refs]) => refs.forEach(index => {
    const entry = entries[index];
    if (entry) { entry.wordStart = start; entry.wordEnd = end; }
  }));
  return entries;
}

export class QuranRepository {
  constructor(db) { this.db = db; }

  static async open() { return new QuranRepository(await openQuranDB()); }

  async hasDataset(version) {
    const tx = this.db.transaction('meta', 'readonly');
    const record = await requestValue(tx.objectStore('meta').get('dataset'));
    return !!record && record.version === version;
  }

  async importLegacy(data, additionalMeanings = [], version = 'siraj-data-v1', onProgress = () => {}) {
    if (!Array.isArray(data) || data.length !== 114 || data.reduce((sum, s) => sum + (Array.isArray(s && s.v) ? s.v.length : 0), 0) !== 6236 ||
        data.some(s => !s || typeof s.n !== 'string' || !Array.isArray(s.v) || s.v.some(v => !v || !Array.isArray(v.w) || !v.w.length || typeof v.e !== 'string' || !Number.isInteger(v.p) || !Number.isInteger(v.j))))
      throw new Error('بيانات المصحف غير صالحة للاستيراد؛ أبقيت قاعدة البيانات الحالية دون تغيير');
    if (await this.hasDataset(version)) return { imported: false, verses: 6236 };

    const clearTx = this.db.transaction(['verses', 'meanings', 'searchDocs', 'meta'], 'readwrite');
    clearTx.objectStore('verses').clear();
    clearTx.objectStore('meanings').clear();
    clearTx.objectStore('searchDocs').clear();
    clearTx.objectStore('meta').delete('dataset');
    await waitTransaction(clearTx);

    const extraByVerse = new Map();
    for (const item of additionalMeanings) {
      if (!item || !Number.isInteger(item.s) || !Number.isInteger(item.v)) continue;
      const key = `${item.s}:${item.v}`;
      if (!extraByVerse.has(key)) extraByVerse.set(key, []);
      extraByVerse.get(key).push(item);
    }

    const allVerses = [];
    data.forEach((surah, si) => surah.v.forEach((verse, vi) => allVerses.push({ surah, verse, s: si + 1, a: vi + 1 })));
    const batchSize = 300;
    for (let start = 0; start < allVerses.length; start += batchSize) {
      const tx = this.db.transaction(['verses', 'meanings', 'searchDocs'], 'readwrite');
      const verses = tx.objectStore('verses'), meanings = tx.objectStore('meanings'), docs = tx.objectStore('searchDocs');
      for (const row of allVerses.slice(start, start + batchSize)) {
          const { surah, verse: v, s, a } = row, id = verseId(s, a);
          verses.put({ id, surah: s, surahName: surah.n, ayah: a, words: v.w, marker: v.m,
            page: v.p, juz: v.j, text: v.e, wordLinks: v.k || [], legacyMeanings: v.x || [] });
          docs.put(searchDocument(`q:${id}`, 'verse', s, a, v.e, { page: v.p, juz: v.j }));
          const entries = sirajMeanings(v, s, a).concat((extraByVerse.get(`${s}:${a}`) || []).map((x, i) => ({
            sourceId: x.sourceId, surah: s, ayah: a, ordinal: i,
            term: x.term, meaning: x.meaning, reference: x.reference || null,
            wordStart: Number.isInteger(x.wordStart) ? x.wordStart : null,
            wordEnd: Number.isInteger(x.wordEnd) ? x.wordEnd : null
          })));
          entries.forEach((entry, i) => {
            const meaning = { ...entry, id: `${id}:${entry.sourceId}:${i}` };
            meanings.put(meaning);
            docs.put(searchDocument(`m:${meaning.id}`, 'meaning', s, a,
              `${entry.term} ${entry.meaning}`, { sourceId: entry.sourceId, reference: entry.reference, term: entry.term, meaning: entry.meaning, page: v.p, juz: v.j }));
          });
      }
      await waitTransaction(tx);
      onProgress(Math.min(start + batchSize, allVerses.length), allVerses.length);
    }

    const pageStarts = {}, juzStarts = {};
    data.forEach((surah, si) => surah.v.forEach((v, vi) => {
      if (!pageStarts[v.p]) pageStarts[v.p] = [si + 1, vi + 1];
      if (!juzStarts[v.j]) juzStarts[v.j] = [si + 1, vi + 1];
    }));
    const done = this.db.transaction('meta', 'readwrite');
    done.objectStore('meta').put({ key: 'dataset', version, surahs: 114, verses: 6236,
      surahMeta: data.map(s => ({ name: s.n, count: s.v.length })), pageStarts, juzStarts,
      basmalaWords: data[0].v[0].w });
    await waitTransaction(done);
    return { imported: true, verses: 6236 };
  }

  async getVerse(surah, ayah) {
    const tx = this.db.transaction('verses', 'readonly');
    return requestValue(tx.objectStore('verses').index('bySurahAyah').get([+surah, +ayah]));
  }

  async getNavigation() {
    const tx = this.db.transaction('meta', 'readonly');
    return requestValue(tx.objectStore('meta').get('dataset'));
  }

  async toLegacyMeta() {
    const metadata = await this.getNavigation();
    if (!metadata || !Array.isArray(metadata.surahMeta)) throw new Error('فهرس بيانات المصحف غير مكتمل');
    return metadata.surahMeta.map(item => ({ n: item.name, v: new Array(item.count) }));
  }

  async getSurah(surah) {
    const tx = this.db.transaction('verses', 'readonly');
    const range = IDBKeyRange.bound([+surah, 0], [+surah, 999]);
    return requestValue(tx.objectStore('verses').index('bySurahAyah').getAll(range));
  }

  async getPage(page) {
    const tx = this.db.transaction('verses', 'readonly');
    const range = IDBKeyRange.bound([+page, 0, 0], [+page, 999, 999]);
    return requestValue(tx.objectStore('verses').index('byPage').getAll(range));
  }

  async getJuz(juz) {
    const tx = this.db.transaction('verses', 'readonly');
    const range = IDBKeyRange.bound([+juz, 0, 0], [+juz, 999, 999]);
    return requestValue(tx.objectStore('verses').index('byJuz').getAll(range));
  }

  async getMeanings(surah, ayah, sourceId) {
    const store = this.db.transaction('meanings', 'readonly').objectStore('meanings');
    if (sourceId) {
      const range = IDBKeyRange.bound([sourceId, +surah, +ayah], [sourceId, +surah, +ayah]);
      return requestValue(store.index('bySourceVerse').getAll(range));
    }
    return requestValue(store.index('byVerse').getAll(IDBKeyRange.only([+surah, +ayah])));
  }

  async getMeaningsBySource(sourceId) {
    const store = this.db.transaction('meanings', 'readonly').objectStore('meanings');
    return requestValue(store.index('bySource').getAll(sourceId));
  }

  async replaceMeaningSource(sourceId, records, version = `${sourceId}-v1`) {
    if (!sourceId || !Array.isArray(records)) throw new Error('مصدر المعاني غير صالح');
    const metaKey = `meaning:${sourceId}`;
    const checkTx = this.db.transaction('meta', 'readonly');
    const marker = await requestValue(checkTx.objectStore('meta').get(metaKey));
    if (marker && marker.version === version) return { imported: false, records: records.length };

    const oldTx = this.db.transaction(['meanings', 'searchDocs'], 'readwrite');
    const oldStores = ['meanings', 'searchDocs'].map(name => oldTx.objectStore(name));
    await new Promise((resolve, reject) => {
      let oldMeanings, oldDocs;
      const removeWhenReady = () => {
        if (!oldMeanings || !oldDocs) return;
        oldMeanings.forEach(x => oldStores[0].delete(x.id));
        oldDocs.forEach(x => oldStores[1].delete(x.id));
      };
      const m = oldStores[0].index('bySource').getAll(sourceId);
      const d = oldStores[1].index('bySource').getAll(sourceId);
      m.onsuccess = () => { oldMeanings = m.result; removeWhenReady(); };
      d.onsuccess = () => { oldDocs = d.result; removeWhenReady(); };
      m.onerror = d.onerror = () => reject(oldTx.error || new Error('تعذّر تحديث مصدر المعاني'));
      oldTx.oncomplete = resolve;
      oldTx.onerror = oldTx.onabort = () => reject(oldTx.error || new Error('تعذّر تحديث مصدر المعاني'));
    });

    for (let start = 0; start < records.length; start += 500) {
      const tx = this.db.transaction(['meanings', 'searchDocs'], 'readwrite');
      const meanings = tx.objectStore('meanings'), docs = tx.objectStore('searchDocs');
      records.slice(start, start + 500).forEach((x, i) => {
        if (!x || x.sourceId !== sourceId || !Number.isInteger(x.s) || !Number.isInteger(x.v) || !x.term || !x.meaning) return;
        const ordinal = start + i, id = `${verseId(x.s, x.v)}:${sourceId}:${ordinal}`;
        const record = { id, sourceId, surah: x.s, ayah: x.v, ordinal, term: x.term,
          meaning: x.meaning, reference: x.reference || null,
          wordStart: Number.isInteger(x.wordStart) ? x.wordStart : null,
          wordEnd: Number.isInteger(x.wordEnd) ? x.wordEnd : null };
        meanings.put(record);
        docs.put(searchDocument(`m:${id}`, 'meaning', x.s, x.v, `${x.term} ${x.meaning}`, {
          sourceId, reference: record.reference, term: x.term, meaning: x.meaning
        }));
      });
      await waitTransaction(tx);
    }
    const done = this.db.transaction('meta', 'readwrite');
    done.objectStore('meta').put({ key: metaKey, version, records: records.length });
    await waitTransaction(done);
    return { imported: true, records: records.length };
  }

  async search(query, { scope = 'all', sourceId, surah, juz, page, limit = 80 } = {}) {
    const terms = tokenize(query);
    if (!terms.length) return [];
    const sets = [];
    for (const term of terms) {
      const index = this.db.transaction('searchDocs', 'readonly').objectStore('searchDocs').index('byToken');
      const matches = new Map();
      const range = IDBKeyRange.bound(term, `${term}\uffff`);
      await new Promise((resolve, reject) => {
        const request = index.openCursor(range);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return resolve();
          matches.set(cursor.value.id, cursor.value);
          cursor.continue();
        };
      });
      sets.push(matches);
    }
    sets.sort((a, b) => a.size - b.size);
    return Array.from(sets[0].values()).filter(doc =>
      sets.every(set => set.has(doc.id)) &&
      (scope === 'all' || (scope === 'quran' ? doc.type === 'verse' : doc.type === 'meaning')) &&
      (!sourceId || doc.type !== 'meaning' || doc.sourceId === sourceId) &&
      (!surah || doc.surah === +surah) && (!juz || doc.juz === +juz) && (!page || doc.page === +page)
    ).slice(0, limit);
  }

  async toLegacyData() {
    const tx = this.db.transaction('verses', 'readonly');
    const records = await requestValue(tx.objectStore('verses').getAll());
    const surahs = [];
    for (const row of records) {
      if (!surahs[row.surah - 1]) surahs[row.surah - 1] = { n: row.surahName, v: [] };
      surahs[row.surah - 1].v[row.ayah - 1] = { w: row.words, m: row.marker, p: row.page,
        j: row.juz, e: row.text, k: row.wordLinks, x: row.legacyMeanings };
    }
    return surahs;
  }
}
