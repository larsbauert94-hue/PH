// Für die Home-Bildschirm-Version auf GitHub Pages wird die App unter einem Unterpfad gebaut,
// z. B. POUR_BASE_URL=/PH/pour (siehe scripts/build-pages.js). Sonst gilt app.json unverändert.
module.exports = ({ config }) =>
  process.env.POUR_BASE_URL
    ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.POUR_BASE_URL } }
    : config
