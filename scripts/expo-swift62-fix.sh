#!/usr/bin/env bash
# Zwei Anpassungen an Expo-Modulen, ohne die Xcode 26 (Swift 6.2) den Build
# abbricht. Beide sind reine Namens-/Attribut-Korrekturen, keine
# Verhaltensaenderung.
#
# WARUM ALS SKRIPT und nicht als Schritte im Workflow: sie standen bis
# 2026-08-16 nur in .github/workflows/ios.yml. Der neue Uhren-Pruefworkflow
# baut dieselbe Pod-Kette (die watchOS-App haengt am iOS-Host-Target) und lief
# deshalb in exakt denselben Fehler — "type of expression is ambiguous without
# a type annotation" in JavaScriptCodable+Date.swift, Lauf 31929279067. Zwei
# Workflows mit derselben Korrektur an zwei Stellen laufen zwangslaeufig
# auseinander; jetzt gibt es eine Quelle.
#
# Aufruf aus apps/mobile (bzw. dem Spiegel-Wurzelverzeichnis):
#   bash scripts/expo-swift62-fix.sh
set -euo pipefail

# ── 1. weak let ────────────────────────────────────────────────────────────
# Swift 6.2 lehnt `weak let` ab ("weak must be a mutable variable"). `weak var`
# waere die semantisch richtige Form — loest aber in expo-modules-jsi den
# naechsten Fehler aus, weil die betroffenen Klassen `Sendable` erklaeren:
# "stored property 'runtime' of 'Sendable'-conforming class is mutable"
# (Lauf 31167963722, exit 65). `nonisolated(unsafe)` ist die dafuer vorgesehene
# Zusicherung: die Referenz bleibt genau so schwach und zugreifbar wie vorher,
# traegt aber die Sendable-Pruefung nicht mehr. Auf Deklarationen ausserhalb
# einer Sendable-Klasse ist das Attribut zulaessig und wirkungslos — deshalb
# genuegt eine Regel fuer alle Fundstellen.
anzahl=0
while IFS= read -r datei; do
  perl -i -pe 's/\bweak let /nonisolated(unsafe) weak var /g' "$datei"
  anzahl=$((anzahl + 1))
done < <(grep -rl "weak let " node_modules --include="*.swift" 2>/dev/null || true)
echo "weak-let -> nonisolated(unsafe) weak var in $anzahl Swift-Dateien"

# ── 2. mehrdeutiges abs() ──────────────────────────────────────────────────
# `abs()` ist in JavaScriptCodable+Date.swift mehrdeutig, seit die Datei per
# `internal import ExpoModulesJSI_Cxx` C++-Interop hereinzieht: dort liegt auch
# das C-`abs` (Int32) aus <cstdlib>, und Xcode 26 kann zwischen beiden nicht
# mehr waehlen (Lauf 31168548252). `Swift.abs` benennt genau die gemeinte
# Ueberladung. Betrifft expo-modules-jsi 57.0.3 — faellt die Zeile in einer
# spaeteren Version weg, laeuft der Block ins Leere (Zaehler 0).
anzahl=0
while IFS= read -r datei; do
  perl -i -pe 's/(?<![.\w])abs\(milliseconds\)/Swift.abs(milliseconds)/g' "$datei"
  anzahl=$((anzahl + 1))
done < <(grep -rl "abs(milliseconds)" node_modules --include="*.swift" 2>/dev/null || true)
echo "abs() eindeutig gemacht in $anzahl Swift-Dateien"
