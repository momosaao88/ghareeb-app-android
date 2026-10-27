import { QuranRepository } from './quran-data.js';
import { createSearchEngine } from './search-engine.js';
import * as MushafRenderer from './mushaf-renderer.js';

const DATASET_VERSION = 'siraj-phase5-local-v2';
const view = document.getElementById('view');

function setStatus(message) {
  if (view) view.textContent = message;
}

function loadClassic(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(`../../${path}`, import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`تعذّر تحميل ${path}`));
    document.head.append(script);
  });
}

async function loadLegacyScripts(includeData) {
  if (includeData && !window.DATA) await loadClassic('data.js');
  if (!window.SirajSources) await loadClassic('scripts/sources.js');
  if (!window.SIRAJ_ADDITIONAL_MEANINGS) await loadClassic('scripts/additional-meanings.js');
  if (!window.SirajCore) await loadClassic('scripts/core.js');
}

async function start() {
  setStatus('يُهيّأ المصحف للاستخدام…');
  let repository;
  try {
    repository = await QuranRepository.open();
    if (await repository.hasDataset(DATASET_VERSION)) {
      window.DATA = await repository.toLegacyMeta();
      await loadLegacyScripts(false);
    } else {
      await loadLegacyScripts(true);
      setStatus('تُحفظ نسخة محلية من البيانات على هذا الجهاز…');
      await repository.importLegacy(window.DATA, window.SIRAJ_ADDITIONAL_MEANINGS,
        DATASET_VERSION, (done, total) => setStatus(`تجهيز المحتوى المحلي: ${done} / ${total}`));
      window.DATA = await repository.toLegacyMeta();
    }
    window.SirajRepository = repository;
    window.SirajNavigation = await repository.getNavigation();
    window.SirajSearch = createSearchEngine(repository);
    window.SirajMushafRenderer = MushafRenderer;
  } catch (error) {
    console.error('Siraj local database bootstrap failed', error);
    setStatus('يجري فتح البيانات المحلية بالطريقة الاحتياطية…');
    await loadLegacyScripts(true);
  }
  const app = document.createElement('script');
  app.src = new URL('../../app.js', import.meta.url).href;
  app.onerror = () => setStatus('تعذّر تشغيل التطبيق. أغلقه وأعد فتحه بعد التحقق من اكتمال الملفات.');
  document.head.append(app);
}

start().catch(error => {
  console.error('Siraj startup failed', error);
  setStatus('تعذّر تحميل بيانات التطبيق محليًا. تحقق من اكتمال التثبيت ثم أعد فتحه.');
});
