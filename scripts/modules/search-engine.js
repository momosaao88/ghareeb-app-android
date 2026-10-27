export function createSearchEngine(repository) {
  return {
    async search(query, options = {}) {
      const records = await repository.search(query, options);
      return records.map(row => row.type === 'verse'
        ? [row.surah, row.ayah, 'آية', row.text]
        : [row.surah, row.ayah, 'معنى', `${row.term} — ${row.meaning}`,
          row.sourceId, row.reference || null]);
    }
  };
}
