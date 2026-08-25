#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Traegt die Schluessel des Kursmenues in alle 14 Sprachdateien ein.

`src/lib/locales.test.ts` prueft zweierlei: gleicher Schluesselumfang wie
Deutsch UND dieselben Platzhalter. Ein Schluessel nur in de/en zu ergaenzen
laesst den Test in zwoelf Sprachen auflaufen - und in der App staende dort
der rohe Schluessel.

Die Platzhalter {n}, {done} und {total} muessen in JEDER Uebersetzung
vorkommen; der Test faengt genau das ab.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOCALES = HERE.parent / "src" / "locales"

TEXTE: dict[str, dict[str, str]] = {
    "coursesTitle": {
        "de": "Kurse", "en": "Courses", "tr": "Kurslar", "ar": "الدورات",
        "es": "Cursos", "fr": "Cours", "id": "Kursus", "bn": "কোর্স",
        "fa": "دوره‌ها", "ms": "Kursus", "ur": "کورسز", "ru": "Курсы",
        "sw": "Kozi", "ps": "کورسونه",
    },
    "coursesSubtitle": {
        "de": "Wähle deinen Kurs und lerne Kapitel für Kapitel",
        "en": "Pick your course and learn chapter by chapter",
        "tr": "Kursunu seç ve bölüm bölüm öğren",
        "ar": "اختر دورتك وتعلّم فصلاً بعد فصل",
        "es": "Elige tu curso y aprende capítulo a capítulo",
        "fr": "Choisis ton cours et apprends chapitre par chapitre",
        "id": "Pilih kursusmu dan belajar bab demi bab",
        "bn": "আপনার কোর্স বেছে নিন এবং অধ্যায় ধরে শিখুন",
        "fa": "دوره خود را انتخاب کنید و فصل به فصل بیاموزید",
        "ms": "Pilih kursus anda dan belajar bab demi bab",
        "ur": "اپنا کورس منتخب کریں اور باب در باب سیکھیں",
        "ru": "Выберите курс и учитесь глава за главой",
        "sw": "Chagua kozi yako na ujifunze sura kwa sura",
        "ps": "خپل کورس وټاکئ او څپرکی په څپرکی زده کړئ",
    },
    "chapterCount": {
        "de": "{n} Kapitel", "en": "{n} chapters", "tr": "{n} bölüm",
        "ar": "{n} فصول", "es": "{n} capítulos", "fr": "{n} chapitres",
        "id": "{n} bab", "bn": "{n} অধ্যায়", "fa": "{n} فصل",
        "ms": "{n} bab", "ur": "{n} ابواب", "ru": "Глав: {n}",
        "sw": "Sura {n}", "ps": "{n} څپرکي",
    },
    "lessonCount": {
        "de": "{n} Lektionen", "en": "{n} lessons", "tr": "{n} ders",
        "ar": "{n} دروس", "es": "{n} lecciones", "fr": "{n} leçons",
        "id": "{n} pelajaran", "bn": "{n} পাঠ", "fa": "{n} درس",
        "ms": "{n} pelajaran", "ur": "{n} اسباق", "ru": "Уроков: {n}",
        "sw": "Masomo {n}", "ps": "{n} درسونه",
    },
    "watchedOf": {
        "de": "{done} von {total} geschaut",
        "en": "{done} of {total} watched",
        "tr": "{total} dersin {done} tanesi izlendi",
        "ar": "شاهدت {done} من {total}",
        "es": "{done} de {total} vistos",
        "fr": "{done} sur {total} regardés",
        "id": "{done} dari {total} ditonton",
        "bn": "{total}-এর মধ্যে {done} দেখা হয়েছে",
        "fa": "{done} از {total} تماشا شده",
        "ms": "{done} daripada {total} ditonton",
        "ur": "{total} میں سے {done} دیکھے گئے",
        "ru": "Просмотрено {done} из {total}",
        "sw": "{done} kati ya {total} zimetazamwa",
        "ps": "له {total} څخه {done} کتل شوي",
    },
    "chapterLabel": {
        "de": "Kapitel {n}", "en": "Chapter {n}", "tr": "Bölüm {n}",
        "ar": "الفصل {n}", "es": "Capítulo {n}", "fr": "Chapitre {n}",
        "id": "Bab {n}", "bn": "অধ্যায় {n}", "fa": "فصل {n}",
        "ms": "Bab {n}", "ur": "باب {n}", "ru": "Глава {n}",
        "sw": "Sura {n}", "ps": "څپرکی {n}",
    },
    "continueCourse": {
        "de": "Weiterlernen", "en": "Continue learning", "tr": "Öğrenmeye devam et",
        "ar": "متابعة التعلّم", "es": "Seguir aprendiendo", "fr": "Continuer à apprendre",
        "id": "Lanjutkan belajar", "bn": "শেখা চালিয়ে যান", "fa": "ادامه یادگیری",
        "ms": "Teruskan belajar", "ur": "سیکھنا جاری رکھیں", "ru": "Продолжить обучение",
        "sw": "Endelea kujifunza", "ps": "زده کړه دوام ورکړئ",
    },
    "allEpisodes": {
        "de": "Alle Videos anzeigen", "en": "Show all videos", "tr": "Tüm videoları göster",
        "ar": "عرض كل الفيديوهات", "es": "Ver todos los vídeos", "fr": "Afficher toutes les vidéos",
        "id": "Tampilkan semua video", "bn": "সব ভিডিও দেখান", "fa": "نمایش همه ویدیوها",
        "ms": "Papar semua video", "ur": "تمام ویڈیوز دکھائیں", "ru": "Показать все видео",
        "sw": "Onyesha video zote", "ps": "ټول ویډیوګانې وښایاست",
    },
}


def main() -> None:
    for datei in sorted(LOCALES.glob("*.json")):
        code = datei.stem
        daten = json.loads(datei.read_text(encoding="utf-8"))
        video = daten.setdefault("video", {})
        gesetzt = 0
        for schluessel, nach_sprache in TEXTE.items():
            wert = nach_sprache.get(code)
            if wert:
                video[schluessel] = wert
                gesetzt += 1
        datei.write_text(json.dumps(daten, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")
        print(f"{code}: {gesetzt} Schluessel")


if __name__ == "__main__":
    main()
