#!/usr/bin/env python3
"""Veroeffentlicht die Studium-Kurs-JSONs + Versions-Manifest fuer OTA-Content-
Updates (s. features/study/courseSync.ts) — nach Cloudflare R2 UND Supabase.

WARUM ZWEI ZIELE:
  · R2 ist das Ziel aller uebrigen Inhalte (Videos, Podcast, Handouts, APK,
    KI-Korpus) und hat keine Egress-Kosten. Neue App-Staende lesen von dort.
  · Supabase bleibt bedient, solange App-Staende im Umlauf sind, die noch
    dorthin zeigen (bis einschliesslich 1.36.0). Sonst bekaemen genau die
    Nutzer die Korrekturen nicht, fuer die das Verfahren gedacht ist.
Faellt ein Ziel aus, bricht der Lauf NICHT ab — das andere wird trotzdem
bedient, und am Ende steht, was fehlschlug.

VERSIONS-LOGIK: Der Client laedt einen Kurs nur, wenn die Fernversion GROESSER
ist als die gebuendelte (COURSE_BUNDLED_VERSION) und groesser als sein Cache.
Die Version wird hier NICHT von Hand gepflegt, sondern aus dem Inhalt
abgeleitet: aendert sich der SHA-256 eines Kurses gegenueber dem
veroeffentlichten Manifest, zaehlt seine Version um eins hoch. Unveraenderte
Kurse behalten ihre Version — sonst wuerde jeder Lauf alle Geraete zu einem
ueberfluessigen Download zwingen.

Beim naechsten App-Release mit aktualisierten Kursdaten muss
COURSE_BUNDLED_VERSION im Client auf die hoechste hier vergebene Version
nachgezogen werden; sonst laedt die neue App ihre eigenen Inhalte nochmal aus
dem Netz.

Aufruf:  cd apps/mobile && python scripts/upload_courses.py [--trocken]
Werte aus .env werden NIE ausgegeben.
"""
import hashlib
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent            # apps/mobile/scripts
DATA = HERE.parent / "src" / "features" / "study" / "data"
REPO = HERE.parents[2]                             # SalatiTech (Repo-Root)
BUCKET = "study"
R2_PREFIX = "kurse"
TROCKEN = "--trocken" in sys.argv

# Kurse werden aus dem Datenverzeichnis abgeleitet, NICHT aufgelistet: die
# frueher fest verdrahtete Liste kannte den neuen Kurs `fiqh-ibadat` nicht, er
# waere stumm nie ausgerollt worden.
COURSE_IDS = sorted(p.stem for p in DATA.glob("*.json"))


def load_env() -> dict:
    envfile = REPO / ".env"
    if not envfile.exists():
        sys.exit("FEHLER: .env fehlt im Repo-Root.")
    env = {}
    for line in envfile.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def req(method: str, url: str, body, headers: dict) -> tuple[int, bytes]:
    r = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # Netzfehler
        return 0, str(e).encode()


def veroeffentlichtes_manifest(urls: list) -> dict:
    """Aktuelles Manifest von einem der Ziele lesen (Grundlage der Versionen)."""
    for u in urls:
        st, body = req("GET", u, None, {})
        if st == 200:
            try:
                return json.loads(body.decode("utf-8"))
            except Exception:
                continue
    return {}


def main() -> None:
    env = load_env()
    fehler = []

    # ---------- Inhalte einlesen und Pruefsummen bilden ----------
    inhalte = {}
    for cid in COURSE_IDS:
        f = DATA / f"{cid}.json"
        daten = json.loads(f.read_text(encoding="utf-8"))  # validiert zugleich
        if not isinstance(daten.get("lessons"), list):
            sys.exit(f"FEHLER: {cid}.json hat kein lessons-Array.")
        inhalte[cid] = json.dumps(daten, ensure_ascii=False).encode("utf-8")
    gesamt_mb = sum(len(v) for v in inhalte.values()) / 1e6
    print(f"{len(inhalte)} Kurse gelesen ({gesamt_mb:.1f} MB kompakt)")

    # ---------- Versionen aus dem veroeffentlichten Stand ableiten ----------
    sb_base = (env.get("SUPABASE_URL") or "").rstrip("/")
    r2_public = (env.get("cloudflare_public_url") or "").rstrip("/")
    quellen = []
    if sb_base:
        quellen.append(f"{sb_base}/storage/v1/object/public/{BUCKET}/manifest.json")
    if r2_public:
        quellen.append(f"{r2_public}/{R2_PREFIX}/manifest.json")
    alt = veroeffentlichtes_manifest(quellen)
    alt_versionen = alt.get("versions") or {}
    alt_sha = alt.get("sha") or {}

    versions, shas, geaendert = {}, {}, []
    for cid, roh in inhalte.items():
        sha = hashlib.sha256(roh).hexdigest()
        shas[cid] = sha
        vorher = int(alt_versionen.get(cid, 0) or 0)
        if vorher and alt_sha.get(cid) == sha:
            versions[cid] = vorher                     # unveraendert
        elif vorher:
            versions[cid] = vorher + 1                 # Inhalt hat sich geaendert
            geaendert.append(cid)
        else:
            # Noch nie veroeffentlicht ODER altes Manifest ohne sha-Feld: eins
            # ueber die bisherige Version, damit Bestandsgeraete es ziehen.
            versions[cid] = max(int(alt_versionen.get(cid, 0) or 0), 1) + 1
            geaendert.append(cid)

    print(f"neu zu verteilen: {len(geaendert)} ({', '.join(geaendert) or 'keiner'})")
    print(f"hoechste Version: {max(versions.values())} -> COURSE_BUNDLED_VERSION im Client nachziehen")

    manifest = json.dumps(
        {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "versions": versions,
            "sha": shas,
        },
        ensure_ascii=False,
    ).encode("utf-8")

    if TROCKEN:
        print("\n--trocken: nichts hochgeladen.")
        return

    # ---------- Ziel 1: Cloudflare R2 ----------
    try:
        import boto3
        from botocore.config import Config

        noetig = ("cloudflare_s3_api", "cloudflare_id", "cloudflare_sec", "cloudflare_bucket")
        if all(env.get(k) for k in noetig):
            s3 = boto3.client(
                "s3",
                endpoint_url=env["cloudflare_s3_api"],
                aws_access_key_id=env["cloudflare_id"],
                aws_secret_access_key=env["cloudflare_sec"],
                config=Config(signature_version="s3v4"),
                region_name="auto",
            )
            eimer = env["cloudflare_bucket"]
            for cid, roh in inhalte.items():
                s3.put_object(Bucket=eimer, Key=f"{R2_PREFIX}/{cid}.json", Body=roh,
                              ContentType="application/json")
            s3.put_object(Bucket=eimer, Key=f"{R2_PREFIX}/manifest.json", Body=manifest,
                          ContentType="application/json")
            print(f"R2: {len(inhalte)} Kurse + Manifest -> {r2_public}/{R2_PREFIX}/")
        else:
            fehler.append("R2 uebersprungen (cloudflare_* unvollstaendig in .env)")
    except Exception as e:  # noqa: BLE001
        fehler.append(f"R2 fehlgeschlagen: {e}")

    # ---------- Ziel 2: Supabase (fuer App-Staende bis 1.36.0) ----------
    try:
        key = env.get("SUPABASE_SERVICE_ROLE_KEY")
        if sb_base and key:
            auth = {"Authorization": f"Bearer {key}", "apikey": key}
            st, _ = req("GET", f"{sb_base}/storage/v1/bucket/{BUCKET}", None, auth)
            if st != 200:
                body = json.dumps({"id": BUCKET, "name": BUCKET, "public": True}).encode()
                st2, resp = req("POST", f"{sb_base}/storage/v1/bucket", body,
                                {**auth, "Content-Type": "application/json"})
                if st2 not in (200, 201):
                    raise RuntimeError(f"Bucket anlegen: {st2} {resp[:120]!r}")

            def hoch(pfad, inhalt):
                st3, resp3 = req("POST", f"{sb_base}/storage/v1/object/{BUCKET}/{pfad}", inhalt,
                                 {**auth, "Content-Type": "application/json", "x-upsert": "true"})
                if st3 not in (200, 201):
                    raise RuntimeError(f"Upload {pfad}: {st3} {resp3[:120]!r}")

            for cid, roh in inhalte.items():
                hoch(f"{cid}.json", roh)
            hoch("manifest.json", manifest)
            print(f"Supabase: {len(inhalte)} Kurse + Manifest -> {BUCKET}/")
        else:
            fehler.append("Supabase uebersprungen (SUPABASE_URL/SERVICE_ROLE_KEY fehlt)")
    except Exception as e:  # noqa: BLE001
        fehler.append(f"Supabase fehlgeschlagen: {e}")

    if fehler:
        print("\nNICHT vollstaendig:")
        for f in fehler:
            print(f"  - {f}")
        sys.exit(1)
    print("\nbeide Ziele bedient.")


if __name__ == "__main__":
    main()
