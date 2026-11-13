#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reader- und Hub-Strings der Bibliothek in alle Locales (ohne de/en)."""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOCALES = HERE.parent / "src" / "locales"
DATA = HERE / "data" / "bibliothek-reader-hub-i18n.json"


def main() -> None:
    patches: dict = json.loads(DATA.read_text(encoding="utf-8"))
    for code, patch in patches.items():
        datei = LOCALES / f"{code}.json"
        daten = json.loads(datei.read_text(encoding="utf-8"))
        bib = daten.setdefault("bibliothek", {})
        hub_patch = patch.pop("hub", None)
        if "tafsirGermanOnly" in patch:
            bib["tafsirGermanOnly"] = patch.pop("tafsirGermanOnly")
        for k, v in patch.items():
            bib[k] = v
        if hub_patch:
            bib["hub"] = {**(bib.get("hub") or {}), **hub_patch}
        datei.write_text(
            json.dumps(daten, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"{code}: {len(patch)} reader, hub={bool(hub_patch)}")


if __name__ == "__main__":
    main()
