#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
from pathlib import Path

from bibliothek_reader_strings import LOCALES

OUT = Path(__file__).resolve().parent / "bibliothek-reader-hub-i18n.json"

if __name__ == "__main__":
    OUT.write_text(json.dumps(LOCALES, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT, "locales", len(LOCALES))
