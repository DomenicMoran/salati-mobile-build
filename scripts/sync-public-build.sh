#!/usr/bin/env bash
# Spiegelt apps/mobile in das Build-Repo (DomenicMoran/salati-mobile-build)
# für die GitHub-Actions-Builds.
#
# UMZUG 2026-08-16: lag vorher unter MenuCloud-Berlin. Dieses Repo war als
# öffentliches gedacht (öffentliche Repos haben unbegrenzte Actions-Minuten),
# stand aber auf privat — damit zählten alle Läufe als bezahlte Minuten, das
# Kontingent lief leer und GitHub verweigerte jeden Start mit "recent account
# payments have failed or your spending limit needs to be increased". Kein
# Android-, iOS- oder Uhren-Build ging mehr durch. Das zweite Konto hat sein
# eigenes, unangetastetes Freikontingent (2000 Minuten/Monat; macOS zählt
# 10-fach, ein iOS-Lauf von 17 Minuten also 170). Der Spiegel bleibt privat.
#
# Läuft das Kontingent auch dort leer, gibt es genau zwei Wege: das Repo
# öffentlich stellen (dann sind die Läufe wieder umsonst) oder das Ausgabe-
# limit anheben. Beides ist eine Entscheidung des Betreibers, keine des Builds.
# NIEMALS Secrets mitspiegeln: credentials.json, .env*, Keystores werden
# ausgeschlossen; Signing läuft nur über Actions-Secrets im Public-Repo.
#
# Ablauf (fester Session-übergreifender Workflow, s. Memory
# project_salati_github_actions_build):
#   1) apps/mobile hierher spiegeln (ohne Secrets/Build-Artefakte)
#   2) Standalone-pnpm-workspace.yaml mit patchedDependencies/overrides schreiben
#   3) committen + pushen -> Actions baut Android (+ iOS) und lädt die APK/IPA
#
# Voraussetzung: GH_TOKEN gesetzt (PAT). Aufruf aus apps/mobile:
#   GH_TOKEN=... bash scripts/sync-public-build.sh
set -euo pipefail

# Zielzweig. Voreinstellung `main` — nur dort loest der Push den Android-Lauf
# aus, der in den Play Store veroeffentlicht. Fuer eine Pruefrunde VOR der
# Veroeffentlichung:
#
#   ZIEL_ZWEIG=pruefung GH_TOKEN=... bash scripts/sync-public-build.sh
#
# Dann laeuft nichts von allein; Android/iOS/Uhr werden auf diesem Zweig von
# Hand gestartet und veroeffentlichen nichts (die Store-Schritte haengen an
# `push` auf `main`). Ohne diesen Weg musste man den Spiegel von Hand
# zusammenbauen — und verlor dabei genau die Schritte, die dieses Skript sonst
# macht (exakte Versionen der gepatchten Pakete, Standalone-.npmrc): der Lauf
# brach dann mit ERR_PNPM_UNUSED_PATCH ab.
ZIEL_ZWEIG="${ZIEL_ZWEIG:-main}"

PUBLIC_REPO="https://x-access-token:${GH_TOKEN}@github.com/DomenicMoran/salati-mobile-build.git"
SRC="$(cd "$(dirname "$0")/.." && pwd)"          # apps/mobile
ROOT="$(cd "$SRC/../.." && pwd)"                  # Monorepo-Root
WORK="$(mktemp -d)"

echo "Klone Public-Repo -> $WORK"
git clone --depth 1 "$PUBLIC_REPO" "$WORK" 2>/dev/null || { mkdir -p "$WORK/repo"; cd "$WORK/repo"; git init -q; git remote add origin "$PUBLIC_REPO"; WORK="$WORK/repo"; }
cd "$WORK"

# Alten Inhalt entfernen (außer .git), dann frisch spiegeln.
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

# git archive exportiert NUR getrackte Dateien -> node_modules, credentials.json,
# .env* und Build-Artefakte (alle gitignored) sind automatisch draußen. Kein
# rsync nötig (fehlt auf Windows).
echo "Spiegle apps/mobile (git archive, nur getrackte Dateien)"
git -C "$ROOT" archive HEAD:apps/mobile | tar -x -C .

# Die pnpm-Patches liegen im Monorepo-ROOT (patches/), nicht in apps/mobile,
# werden aber von der Standalone-pnpm-workspace.yaml (patchedDependencies)
# referenziert -> ebenfalls mitspiegeln, sonst schlägt `pnpm install` mit ENOENT
# auf die Patch-Datei fehl.
rm -rf patches && mkdir -p patches
git -C "$ROOT" archive HEAD:patches | tar -x -C patches

# Website-APK-Teile (164MB, im Privat-Repo getrackt) gehören NICHT ins
# Build-Mirror.
rm -f public/salati.apk.part00 public/salati.apk.part01
# Sicherheitsnetz: falls doch mal ein Secret getrackt wäre, hier raus.
rm -f credentials.json .env .env.* 2>/dev/null || true

# debug.keystore ist Googles ÖFFENTLICHER Debug-Key (unbedenklich) — bleibt,
# damit reine Debug-Builds funktionieren; Release signiert via Secret.

# Standalone-pnpm-Config (pnpm10 liest Settings aus pnpm-workspace.yaml).
cat > pnpm-workspace.yaml <<'YAML'
# Standalone (kein Workspace) — nur die Build-Settings aus dem Monorepo.
neverBuiltDependencies:
  - sharp
overrides:
  "brace-expansion@<1.1.14": ">=1.1.14 <2.0.0"
  "brace-expansion@>=2.0.0 <2.0.3": ">=2.0.3 <3.0.0"
  "esbuild@<0.25.0": ">=0.25.0"
  "form-data@>=4.0.0 <4.0.6": ">=4.0.6"
  "postcss@<8.5.10": ">=8.5.10"
  "qs@<6.15.2": ">=6.15.2"
patchedDependencies:
  '@bacons/apple-targets@5.0.0': patches/@bacons__apple-targets@5.0.0.patch
  expo-dynamic-app-icon@1.2.0: patches/expo-dynamic-app-icon@1.2.0.patch
  whisper.rn@0.7.0: patches/whisper.rn@0.7.0.patch
YAML
# unrs-resolver-Patch bewusst NICHT aufgeführt: das Paket ist nur ein
# transitives Dep des Monorepo-Root-Toolings (ESLint/oxc), nicht von
# apps/mobile — im Standalone-Build fehlt es, und pnpm bricht bei einem
# ungenutzten Patch hart ab (ERR_PNPM_UNUSED_PATCH).

# Gepatchte Pakete auf ihre EXAKTE Version festnageln.
#
# WARUM (Build-Abbruch 2026-08-07): Das Mirror-Repo hat keine pnpm-lock.yaml —
# die des Monorepos beschreibt den ganzen Workspace und passt hier nicht. Der
# Runner löst deshalb frisch auf, und `"whisper.rn": "^0.7.0"` wurde zu 0.7.2,
# sobald das Paket eine neue Version veröffentlicht hatte. Der Patch-Schlüssel
# `whisper.rn@0.7.0` traf damit nichts mehr und pnpm brach mit
# ERR_PNPM_UNUSED_PATCH ab — nach 30 Sekunden, ohne dass am Code etwas falsch
# war. Lokal fiel es nie auf, weil dort der Lockfile 0.7.0 festhält.
#
# Die Versionen werden aus den patchedDependencies-Schlüsseln oben gelesen,
# damit es genau EINE Quelle für sie gibt.
node - <<'NODE'
const fs = require('fs');
const yaml = fs.readFileSync('pnpm-workspace.yaml', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const block = yaml.slice(yaml.indexOf('patchedDependencies:'));
let angepasst = 0;
for (const zeile of block.split('\n').slice(1)) {
  const treffer = /^\s+'?([^'\s]+)@([0-9][^'\s:]*)'?:/.exec(zeile);
  if (!treffer) continue;
  const [, name, version] = treffer;
  for (const feld of ['dependencies', 'devDependencies']) {
    if (pkg[feld]?.[name] && pkg[feld][name] !== version) {
      console.log(`  ${name}: ${pkg[feld][name]} -> ${version} (gepatcht, exakt)`);
      pkg[feld][name] = version;
      angepasst++;
    }
  }
}
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`Gepatchte Abhaengigkeiten festgenagelt: ${angepasst}`);
NODE

# Standalone-.npmrc (NICHT die Root-.npmrc kopieren): die Root nutzt
# node-linker=isolated + kurzen virtual-store-dir als reinen WINDOWS-Workaround
# gegen die 260-Zeichen-Pfadgrenze. Auf dem Linux-CI-Runner gibt es die Grenze
# nicht — dort ist ein flaches, klassisches node_modules (hoisted) nötig, weil
# @bacons/apple-targets bei der Expo-Config-Auflösung (createExpoConfig) das nur
# transitiv vorhandene @expo/image-utils per require anzieht, OHNE es zu
# deklarieren; im isolierten Store scheitert das mit "Cannot find module
# '@expo/image-utils'". hoisted stellt alle Pakete flach bereit → auffindbar.
cat > .npmrc <<'NPMRC'
auto-install-peers=true
strict-peer-dependencies=false
node-linker=hoisted
NPMRC

cat > README.md <<'MD'
# Salati Mobile — Build-Mirror (öffentlich)

Automatisch gespiegelter Build-Mirror von `apps/mobile` (Privat-Repo) für
**kostenlose GitHub-Actions-Builds** (Android/iOS). **Enthält keine Secrets** —
Signing läuft ausschließlich über verschlüsselte Actions-Secrets.
Nicht direkt hier entwickeln; Änderungen kommen per Sync aus dem Privat-Repo.
MD

git add -A
if git diff --cached --quiet; then echo "Keine Änderungen."; else
  git -c user.name="MenuCloud Berlin" -c user.email="menucloudberlin@gmail.com" commit -q -m "Sync apps/mobile ($(date -u +%Y-%m-%dT%H:%MZ))"
  git branch -M "$ZIEL_ZWEIG"
  git push -u -f origin "$ZIEL_ZWEIG"
  if [ "$ZIEL_ZWEIG" = "main" ]; then
    echo "Gepusht -> Actions-Build startet und veroeffentlicht."
  else
    echo "Gepusht auf '$ZIEL_ZWEIG' -> nichts wird veroeffentlicht; Laeufe von Hand starten."
  fi
fi
