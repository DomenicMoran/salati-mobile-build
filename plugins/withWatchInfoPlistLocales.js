// Kopiert NSLocationWhenInUseUsageDescription aus ios-locales/*.json in die
// watchOS-Companion-App (targets/salati-watch). Die iPhone-App bekommt dieselben
// Texte ueber Expo `locales` + @expo/config-plugins/withLocales; das Uhr-Ziel
// liegt ausserhalb dieses Pfads und braucht eigene *.lproj/InfoPlist.strings.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const WATCH_REL = path.join('targets', 'salati-watch');
const LOCATION_KEY = 'NSLocationWhenInUseUsageDescription';

function readLocationStrings(projectRoot) {
  const dir = path.join(projectRoot, 'ios-locales');
  const out = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json') || file === 'catalog.json') continue;
    const lang = file.replace(/\.json$/, '');
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const ios = json.ios ?? json;
    if (typeof ios[LOCATION_KEY] === 'string' && ios[LOCATION_KEY].trim()) {
      out[lang] = ios[LOCATION_KEY];
    }
  }
  return out;
}

function writeInfoPlistStrings(dir, stringsMap) {
  for (const [lang, text] of Object.entries(stringsMap)) {
    const lproj = path.join(dir, `${lang}.lproj`);
    fs.mkdirSync(lproj, { recursive: true });
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    fs.writeFileSync(
      path.join(lproj, 'InfoPlist.strings'),
      `${LOCATION_KEY} = "${escaped}";\n`,
      'utf8',
    );
  }
}

function withWatchInfoPlistLocales(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const watchRoot = path.join(projectRoot, WATCH_REL);
      if (!fs.existsSync(watchRoot)) {
        return cfg;
      }
      const stringsMap = readLocationStrings(projectRoot);
      writeInfoPlistStrings(watchRoot, stringsMap);
      return cfg;
    },
  ]);
}

module.exports = withWatchInfoPlistLocales;
