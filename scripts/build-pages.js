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

const head = `
    <link rel="manifest" href="${base}/manifest.webmanifest">
    <link rel="apple-touch-icon" href="${base}/icons/icon-180.png">
    <meta name="theme-color" content="#0b1029">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Pour">
    <script>window.__POUR_BASE__ = '${base}/'</script>
    <style>
      html, body { background: #0b1029; color-scheme: dark; }
      /* iPhone-Home-Bildschirm: App fest an alle Ränder heften, sonst bleibt unten ein Streifen frei */
      #root { position: fixed; top: 0; right: 0; bottom: 0; left: 0; height: auto !important; }
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
fs.rmSync(path.join(out, 'metadata.json'), { force: true })
console.log(`Home-Bildschirm-App für ${base}/ in ${out}`)
