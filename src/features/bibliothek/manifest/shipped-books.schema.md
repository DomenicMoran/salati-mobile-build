# shipped-books.manifest.json — Schema (v1)

Kanonicaler Intake- und Ship-Manifest für Bibliothek-PDFs (Phase C). Validiert mit `scripts/bibliothek-intake-validate.mjs`.

## Root

| Feld | Typ | Pflicht |
|------|-----|---------|
| `schema` | `1` | ja |
| `stand` | ISO-Datum `YYYY-MM-DD` | ja |
| `source` | string (Herkunfts-Index, z. B. `idx-handouts.json`) | ja |
| `items` | `ShippedBookItem[]` | ja |
| `audiobookPdfTracks` | `AudiobookTrackRef[]` | nein |
| `tafsir` | `TafsirRef[]` | nein |

## `ShippedBookItem` (`items[]`)

### Pflicht (jedes Item)

| Feld | Typ | Regel |
|------|-----|--------|
| `id` | string | stabil, kebab-case |
| `title` | string | Anzeigetitel |
| `license` | string | z. B. `salati-original`, `ib-rassoul-release`, `hadeethenc-app-only` |
| `lizenz` | string | optional, muss mit `license` übereinstimmen (UI/Audit-Alias) |
| `beleg_url` | string | Lizenznachweis-URL oder Repo-Pfad unter `public/licenses/`; Pflicht wenn `visible` nicht `false` und `licenseStatus` cleared |
| `licenseStatus` | `"cleared"` \| `"pending"` | nur `cleared` darf `visible: true` haben |
| `rightsHolder` | string | Rechteinhaber / Verlag |
| `category` | siehe Enum unten | Hub-Filter Phase C |
| `sourceUrl` | string | Repo-Pfad, Lizenzakte oder dokumentierte Primärquelle (kein Secret) |
| `reviewer` | string | verantwortliche Prüfperson / Rolle |
| `reviewedAt` | `YYYY-MM-DD` | Datum der letzten Freigabe-Prüfung |
| `islamicNota` | string | Madhhab/Quelle/Korrektheits-Hinweis für UI oder Audit |

### Verteilung (mindestens eines)

| Feld | Typ | Hinweis |
|------|-----|---------|
| `pdf_url` | URL | Produktions-R2 o. ä. |
| `pdf_local` | repo-relativer Pfad | Entwürfe / Staging |
| `buildManifest` | repo-relativer Pfad | All-in-One Segment-Offsets |

### Optional

| Feld | Typ | Regel |
|------|-----|--------|
| `visible` | boolean | Default implizit `true` für shipped Handouts — **explizit `false`** für Draft/Warteliste |
| `releaseStatus` | `"draft"` \| `"staging"` \| `"prod"` | All-in-One o. ä. |
| `tocManifest` | string | Redaktions-TOC (JSON) |
| `supersedes` | string | ersetzte Werk-ID |
| `pages`, `size_kb`, `notes` | — | Metadaten |
| `sha256` | hex | Pflicht bei PD-Drittwerken (`LicenseRef-*`) vor `visible:true` (oder Hash in `notes` bei Staging) |

### `category` (Enum, Phase C UI)

`Aqida` | `Ibadah` | `Arabisch` | `Qur'an` | `Seerah` | `Hadith` | `Akhlaq` | `Familie` | `Lernpfad`

## `AudiobookTrackRef` (`audiobookPdfTracks[]`)

Pflicht: `track`, `license`, `licenseStatus`, `rightsHolder`, `category`, `sourceUrl`, `reviewer`, `reviewedAt`, `islamicNota`.

## `TafsirRef` (`tafsir[]`)

Pflicht: `id`, `license`, `licenseStatus`, `rightsHolder`, `category`, `sourceUrl`, `reviewer`, `reviewedAt`, `islamicNota`.

## Gates (kein `visible: true` wenn …)

1. `licenseStatus === "pending"`
2. `releaseStatus === "draft"` ohne explizite Prod-Freigabe
3. Intake-Checkliste (`output/audit-20261110-p2/intake-checklist.md`) nicht abgehakt

## Beispiel (gekürzt)

```json
{
  "id": "aqida",
  "title": "Aqida — der Glaube",
  "license": "salati-original",
  "licenseStatus": "cleared",
  "rightsHolder": "Salatibox - Inh. Domenic Moran",
  "category": "Aqida",
  "sourceUrl": "podcast/handouts/aqida.pdf",
  "reviewer": "Salatibox editorial",
  "reviewedAt": "2026-11-10",
  "islamicNota": "Eigenes Salati-Lehrmaterial; sunnitische Aqida ohne Madhhab-Zwang.",
  "pdf_url": "https://…/handouts/aqida.pdf"
}
```
