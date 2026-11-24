// Kopiert die WebAssembly-Datei von Skia (CanvasKit) nach public/, damit der Foto-Editor
// auch in der Web-Version funktioniert. Läuft automatisch nach npm install.
const fs = require('fs')
const path = require('path')
const src = path.join(__dirname, '..', 'node_modules', 'canvaskit-wasm', 'bin', 'full', 'canvaskit.wasm')
const dest = path.join(__dirname, '..', 'public', 'canvaskit.wasm')
if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}
