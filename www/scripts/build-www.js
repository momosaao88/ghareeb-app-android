// نسخ ملفات الويب إلى www/ (المجلد الذي يقرأه Capacitor)
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, '..', 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html','styles.css','app.js','data.js','sw.js','manifest.json','privacy.html','fonts','icons']) {
  fs.cpSync(path.join(__dirname, '..', f), path.join(out, f), { recursive: true });
}
fs.cpSync(__dirname, path.join(out, 'scripts'), { recursive: true });
console.log('www/ ready');
