// Baut Pour als Home-Bildschirm-App (Vollbild, eigenes Symbol) für GitHub Pages.
//   node scripts/build-pages.js /PH/pour [Zielordner]
// Ergebnis in dist-pages/ (bzw. Zielordner): diesen Inhalt in den Pages-Ordner kopieren.
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const base = (process.argv[2] ?? '/PH/pour').replace(/\/$/, '')
const out = path.resolve(process.argv[3] ?? path.join(__dirname, '..', 'dist-pages'))
const root = path.join(__dirname, '..')

execSync(`npx expo export -p web --output-dir "${out}"`, { cwd: root, stdio: 'inherit', env: { ...process.env, POUR_BASE_URL: base } })

// Neue Version sofort laden: GitHub Pages lässt Browser index.html bis zu 10 Minuten zwischenspeichern
const build = Date.now().toString(36)
const head = `
    <link rel="manifest" href="${base}/manifest.webmanifest">
    <link rel="apple-touch-icon" href="${base}/icons/icon-180.png">
    <meta name="theme-color" content="#0b1029">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Pour">
    <script>
      window.__POUR_BASE__ = '${base}/';
      // iPhone-Home-Bildschirm: Safari meldet hier ein um die Statusleiste zu kurzes Fenster.
      // Daher die echte Bildschirmhöhe nehmen, sonst bleibt unten ein Streifen frei.
      (function () {
        var standalone = navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)
        function fit() {
          var portrait = window.innerHeight > window.innerWidth
          var h = standalone && portrait ? Math.max(window.innerHeight, screen.height) : window.innerHeight
          document.documentElement.style.setProperty('--app-h', h + 'px')
        }
        fit(); window.addEventListener('resize', fit)
      })();
      fetch('${base}/version.json?' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json() }).then(function (j) {
        if (j.v !== '${build}' && location.search.indexOf('v=' + j.v) < 0) location.replace('${base}/?v=' + j.v)
      }).catch(function () {})
    </script>
    <style>
      html, body { background: #0b1029; color-scheme: dark; }
      /* iPhone-Home-Bildschirm: App fest an alle Ränder heften, sonst bleibt unten ein Streifen frei */
      #root { position: fixed; top: 0; right: 0; left: 0; bottom: auto; height: var(--app-h, 100%) !important; }
    </style>
`
const index = path.join(out, 'index.html')
let html = fs.readFileSync(index, 'utf8')
html = html
  .replace('shrink-to-fit=no', 'viewport-fit=cover')
  .replace('<html lang="en">', '<html lang="de">')
  .replace('</head>', `${head}</head>`)
fs.writeFileSync(index, html)

fs.cpSync(path.join(root, 'assets', 'pwa'), path.join(out, 'icons'), { recursive: true })
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Pour', short_name: 'Pour', lang: 'de', start_url: `${base}/`, scope: `${base}/`, display: 'standalone',
  background_color: '#0b1029', theme_color: '#0b1029', orientation: 'portrait',
  icons: [
    { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
    { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2))
fs.writeFileSync(path.join(out, '.nojekyll'), '')
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ v: build }))
fs.rmSync(path.join(out, 'metadata.json'), { force: true })
console.log(`Home-Bildschirm-App für ${base}/ in ${out}`)
