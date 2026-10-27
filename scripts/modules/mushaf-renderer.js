function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

// Diagnostic compatibility fix: restore the RTL marks used by the older renderer.
function mushafWordText(value) {
  return Array.from(String(value)).map((character) => '\u200f' + character).join('');
}

export function wordMarkup(word, index, meaningIds = [], highlighted = false, className = '') {
  const ids = meaningIds.join(' ');
  if (highlighted) {
    return `<mark class=\"quran-word ${escapeHtml(className)}\" tabindex=\"0\" role=\"button\" aria-label=\"عرض معنى الكلمة من الكتاب المختار\" data-word=\"${index}\" data-k=\"${ids}\">${escapeHtml(mushafWordText(word))}</mark>`;
  }
  return `<button type=\"button\" class=\"quran-word quran-word-action\" aria-label=\"عرض معنى الكلمة\" data-word=\"${index}\">${escapeHtml(mushafWordText(word))}</button>`;
}

export function renderVerse(container, verse, { surah, ayah, onWordSelect }) {
  const article = document.createElement('article');
  article.className = 'v'; article.dir = 'rtl'; article.lang = 'ar';
  article.dataset.s = String(surah); article.dataset.v = String(ayah);
  const text = document.createElement('span'); text.className = 't';
  verse.words.forEach((word, index) => {
    if (index) text.append(document.createTextNode(' '));
    const node = document.createElement('button');
    node.type = 'button'; node.className = 'quran-word quran-word-action';
    node.textContent = mushafWordText(word); node.dataset.wordIndex = String(index);
    node.setAttribute('aria-label', 'عرض معنى الكلمة');
    node.addEventListener('click', () => onWordSelect({ surah, ayah, wordIndex: index }));
    text.append(node);
  });
  article.append(text, document.createTextNode(' '));
  const marker = document.createElement('span'); marker.className = 'n t';
  marker.textContent = verse.marker; article.append(marker);
  container.append(article);
  return article;
}
