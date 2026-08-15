#!/usr/bin/env python3
"""Baut den deutschen Tafsir-Datensatz aus dem Original-PDF.

Quelle: "Tafsir Al-Qur'an Al-Karim - Erlaeuterung des Al-Qur'an Al-Karim in
deutscher Sprache" von Abu-r-Rida Muhammad Ibn Ahmad Ibn Rassoul,
IB Verlag Islamische Bibliothek, Koeln, 41. Auflage (2008), 1093 Seiten.

Rechtslage (der Grund, warum dieser Text ueberhaupt genutzt werden darf):
Der Autor hat das Werk ausdruecklich freigegeben. Wortlaut im Impressum:
"Die Vervielfaeltigung, der Nachdruck und die Uebersetzung dieses Werkes in
eine Fremdsprache sind erlaubt, wenn dabei auf diese Quelle hingewiesen wird."
Und im Vorwort: "Aus diesem Grund gebe ich dieses Werk voellig frei von
Copyright und allen Verlagsrechten, wie dies im Impressum deutlich steht."
Ein Schlusswort auf S. 1090 wiederholt das. Einzige Auflage ist also die
Quellennennung - siehe TAFSIR_DE_ATTRIBUTION in src/features/quran/api.ts.

Verfahren: Im PDF steht die Koranuebersetzung in FreeSerifBold, der Kommentar
in FreeSerif. Genau daran wird getrennt - der Kommentar-Textstrom wird
uebernommen, die Uebersetzung nicht (die App zeigt dort ihre eigene, vom Nutzer
gewaehlte Uebersetzung). Kommentarbloecke sind im Original mit "2:8-9 - " o. ae.
ueberschrieben; daraus entstehen die Vers-Bezuege.

Der Text wird NICHT veraendert: keine Kuerzung, keine Umformulierung, keine
Rechtschreibkorrektur. Einzige Eingriffe sind Whitespace-Normalisierung und
das Zusammenziehen von Trennstrichen am Zeilenende.

Ausfuehren (einmalig bzw. nach PDF-Aktualisierung):
    pip install pdfplumber
    python scripts/build-tafsir-de.py
Ergebnis: build/tafsir-de/<sure>.json  ->  scripts/upload-tafsir-de-r2.mjs
"""
from __future__ import annotations

import collections
import json
import os
import re
import sys
import urllib.request

PDF_URL = "https://islamicbulletin.org/de/ebooks/koran/tafsir_al_quran.pdf"

HIER = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.dirname(HIER)
BUILD = os.path.join(MOBILE, "build", "tafsir-de")
PDF = os.path.join(MOBILE, "build", "tafsir_al_quran.pdf")
ROH = os.path.join(MOBILE, "build", "tafsir-de-roh.txt")

# Verszahlen nach Hafs — Gegenprobe, damit kein Marker aus einem Querverweis
# ("vgl. 2:219; 4:43") als Blockanfang durchrutscht.
AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]

SEP = "␟"  # Platzhalter fuer eine dazwischenliegende Koranuebersetzung
MARK = re.compile(r"(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*[-–]\s")
ONLY = re.compile(r"^(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*[-–]?\s*$")
# Zierzitate zwischen den Kapiteln: "(54) Sura Al-Qamar (Der Mond), Vers 22"
DECOR = re.compile(r"^\(\d{1,3}\)\s*Sura .{0,60}Vers\s+\d+\.?$")


def hole_pdf() -> None:
    if os.path.exists(PDF):
        return
    os.makedirs(os.path.dirname(PDF), exist_ok=True)
    print(f"lade {PDF_URL}")
    urllib.request.urlretrieve(PDF_URL, PDF)


def kommentar_strom() -> str:
    """Nur der nicht-fette Textstrom; fette Abschnitte werden zu SEP.

    Der Durchlauf ueber 1093 Seiten dauert rund zehn Minuten, deshalb wird das
    Ergebnis zwischengespeichert (build/tafsir-de-roh.txt loeschen erzwingt
    eine Neuextraktion).
    """
    import pdfplumber

    if os.path.exists(ROH):
        with open(ROH, encoding="utf-8") as f:
            return f.read()

    teile: list[str] = []
    with pdfplumber.open(PDF) as pdf:
        for nr, seite in enumerate(pdf.pages):
            zeilen: dict[float, list] = {}
            for ch in seite.chars:
                zeilen.setdefault(round(ch["top"], 0), []).append(ch)
            tops = sorted(zeilen)
            weg = set()
            for rand in (tops[:1] + tops[-1:]) if tops else []:
                text = "".join(c["text"] for c in sorted(zeilen[rand], key=lambda c: c["x0"])).strip()
                if text.startswith("Tafs") or re.fullmatch(r"\d{1,4}", text):
                    weg.add(rand)
            fett = None
            for top in tops:
                if top in weg:
                    continue
                for ch in sorted(zeilen[top], key=lambda c: c["x0"]):
                    ist_fett = "Bold" in ch["fontname"]
                    if ist_fett != fett:
                        teile.append(f"\n{SEP}\n" if ist_fett else "")
                        fett = ist_fett
                    if not ist_fett:
                        teile.append(ch["text"])
                if teile:
                    teile.append(" ")
            if nr % 200 == 0:
                print(f"  Seite {nr}/{len(pdf.pages)}", file=sys.stderr)
    roh = "".join(teile)
    with open(ROH, "w", encoding="utf-8") as f:
        f.write(roh)
    return roh


def gueltig(s: int, a: int, b: int, letzter: tuple[int, int]) -> bool:
    if not 1 <= s <= 114 or a < 1 or b < a or b > AYAH_COUNTS[s - 1]:
        return False
    ls, la = letzter
    return a > la if s == ls else ls < s <= ls + 2


def marker(chunk: str, letzter: tuple[int, int], begonnen: bool):
    treffer = []
    for m in MARK.finditer(chunk):
        if m.start() != 0:
            davor = chunk[: m.start()].rstrip()
            if not davor or davor[-1] not in ".!?:»“)]":
                continue
        s, a = int(m.group(1)), int(m.group(2))
        b = int(m.group(3)) if m.group(3) else a
        bezug = letzter if not treffer else (treffer[-1][0], treffer[-1][2])
        if gueltig(s, a, b, bezug) or (not begonnen and not treffer and (s, a) == (1, 1)):
            treffer.append((s, a, b, m.start(), m.end()))
    return treffer


def saeubere(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def bindestriche(text: str) -> str:
    """Trennstrich am Zeilenende wieder zusammenziehen.

    "Qur'an- Vers" -> "Qur'an-Vers". Der Lookbehind auf einen Buchstaben ist
    wichtig: ohne ihn wuerde auch der Trenner einer Vers-Marke ("14:52 - Der")
    zusammengezogen. Haengende Bindestriche vor Kleinschrift ("Land- und
    Forstwirtschaft") bleiben unangetastet - dort ist der Strich gewollt.
    """
    return re.sub(r"(?<=[A-Za-zÄÖÜäöüß])-\s+([A-ZÄÖÜ])", r"-\1", text)


def baue(strom: str):
    chunks = [saeubere(c) for c in strom.split(SEP)]
    chunks = [c for c in chunks if c and not DECOR.match(c)]

    bloecke: list[list] = []
    letzter, begonnen = (1, 0), False
    for i, c in enumerate(chunks):
        if begonnen and letzter[0] == 114:
            break  # ab hier folgt nur noch der Nachspann (Register, Literatur)
        nur = ONLY.match(c)
        if nur:
            s, a = int(nur.group(1)), int(nur.group(2))
            b = int(nur.group(3)) if nur.group(3) else a
            if gueltig(s, a, b, letzter) or (not begonnen and (s, a) == (1, 1)):
                bloecke.append([s, a, b, []])
                letzter, begonnen = (s, b), True
                continue
        schnitte = marker(c, letzter, begonnen)
        if not schnitte:
            if not begonnen:
                continue
            # Sura-Einleitung (steht vor dem ersten Vers-Marker der neuen Sure)
            naechster = chunks[i + 1] if i + 1 < len(chunks) else ""
            folge = marker(naechster, letzter, begonnen)
            if folge and folge[0][0] != letzter[0]:
                continue
            bloecke[-1][3].append(c)
            continue
        if schnitte[0][3] > 0 and bloecke:
            bloecke[-1][3].append(c[: schnitte[0][3]].strip())
        for j, (s, a, b, _st, en) in enumerate(schnitte):
            ende = schnitte[j + 1][3] if j + 1 < len(schnitte) else len(c)
            bloecke.append([s, a, b, [c[en:ende].strip()]])
            letzter, begonnen = (s, b), True

    nach_sure = collections.defaultdict(list)
    for s, a, b, teile in bloecke:
        text = bindestriche(re.sub(r"\s+", " ", " ".join(t for t in teile if t)).strip())
        if len(text) >= 5:
            nach_sure[s].append({"from": a, "to": b, "text": text})
    return nach_sure


def main() -> int:
    hole_pdf()
    nach_sure = baue(kommentar_strom())

    fehlend = [s for s in range(1, 115) if s not in nach_sure]
    if fehlend:
        print(f"FEHLER: Suren ohne Kommentar: {fehlend}")
        return 1

    os.makedirs(BUILD, exist_ok=True)
    bloecke = verse = 0
    for s in range(1, 115):
        eintraege = sorted(nach_sure[s], key=lambda e: (e["from"], e["to"]))
        bloecke += len(eintraege)
        abgedeckt = set()
        for e in eintraege:
            abgedeckt.update(range(e["from"], e["to"] + 1))
        verse += len(abgedeckt)
        with open(os.path.join(BUILD, f"{s}.json"), "w", encoding="utf-8") as f:
            json.dump({"sura": s, "blocks": eintraege}, f, ensure_ascii=False)

    gesamt = sum(AYAH_COUNTS)
    print(f"{bloecke} Bloecke, {verse}/{gesamt} Verse ({100 * verse / gesamt:.1f} %) -> {BUILD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
