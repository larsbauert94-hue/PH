// Baut aus dem Web-Export (dist/) eine Version, die unter einem beliebigen Unterpfad läuft
// (z. B. als geteilte Web-App-Seite). Aufruf nach `npx expo export -p web`:
//   node scripts/build-artifact.js [Zielordner]
// Absolute Pfade "/assets/…" und "/_expo/…" im Bundle werden auf eine Basis-Adresse umgebogen,
// die beim Laden der Seite ermittelt wird (window.__POUR_BASE__).
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
// --pwa: eigenständige Webseite (z. B. GitHub Pages) mit App-Symbol und Vollbild auf dem Home-Bildschirm
const pwa = args.includes('--pwa')
const src = path.resolve(__dirname, '..', 'dist')
const out = path.resolve(args.find(a => !a.startsWith('--')) ?? path.join(__dirname, '..', pwa ? 'dist-pwa' : 'dist-artifact'))
if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('dist/index.html fehlt – zuerst `npx expo export -p web` ausführen.')
  process.exit(1)
}
fs.rmSync(out, { recursive: true, force: true })

const BASE = '(self.__POUR_BASE__||"/")+'
const files = []
function copy(dir) {
  for (const entry of fs.readdirSync(path.join(src, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) { copy(rel); continue }
    // Namen mit "_" am Anfang sind beim Hosting reserviert → _expo/ wird zu app/
    const outRel = rel.replace(/^_expo\//, 'app/')
    if (rel === 'index.html' || rel === 'metadata.json') continue
    const target = path.join(out, outRel)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (rel.endsWith('.js')) {
      const code = fs.readFileSync(path.join(src, rel), 'utf8')
        .replaceAll('"/assets/', BASE + '"assets/')
        .replaceAll('"/_expo/static/', BASE + '"app/static/')
      fs.writeFileSync(target, code)
    } else {
      fs.copyFileSync(path.join(src, rel), target)
    }
    files.push(outRel)
  }
}
copy('')

const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script src="\/([^"]+)"/g)].map(m => m[1].replace(/^_expo\//, 'app/'))

const head = pwa ? `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<meta name="mobile-web-app-capable" content="yes">
` : ''
fs.writeFileSync(path.join(out, 'index.html'), `${head}<title>Pour</title>
<meta name="theme-color" content="#0b1029">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Pour">
${pwa ? '</head>\n<body>\n' : ''}<style>
  :root { color-scheme: dark; background: #0b1029; }
  html, body { height: 100%; background: #0b1029; color: #f3ede6; }
  body { overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
  #pour-boot { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: #0b1029; color: #e3a585; font: 600 15px system-ui, sans-serif; letter-spacing: .08em; }
</style>
<div id="root"></div>
<div id="pour-boot">POUR</div>
<script>
  (function () {
    var base = new URL('.', location.href).href
    window.__POUR_BASE__ = base
    // Die App-Navigation startet immer auf der Startseite
    try { history.replaceState(null, '', '/') } catch (e) {}
    var files = ${JSON.stringify(scripts)}
    files.forEach(function (f) {
      var s = document.createElement('script')
      s.src = base + f
      s.async = false
      document.body.appendChild(s)
    })
    var boot = document.getElementById('pour-boot')
    var obs = new MutationObserver(function () {
      if (document.getElementById('root').childElementCount) { boot.remove(); obs.disconnect() }
    })
    obs.observe(document.getElementById('root'), { childList: true })
  })()
</script>
${pwa ? '</body>\n</html>\n' : ''}`)

if (pwa) {
  // App-Symbole und Manifest für „Zum Home-Bildschirm“
  const icons = path.join(__dirname, '..', 'assets', 'pwa')
  fs.cpSync(icons, path.join(out, 'icons'), { recursive: true })
  fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
    name: 'Pour', short_name: 'Pour', lang: 'de', start_url: '.', scope: '.', display: 'standalone',
    background_color: '#0b1029', theme_color: '#0b1029', orientation: 'portrait',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2))
  fs.writeFileSync(path.join(out, '.nojekyll'), '')
  fs.rmSync(path.join(out, 'files.json'), { force: true })
}
if (!pwa) fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 1))
console.log(`${files.length} Dateien nach ${out}`)
