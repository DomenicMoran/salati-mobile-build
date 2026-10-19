# Play-Console-Empfehlungen — Analyse (Release 1.27.21 / vc33)

> Stand 2026-07-23. Untersuchung der vier Play-Console-Empfehlungen für einen
> künftigen **vc34**. vc33 (1.27.21) ist bereits eingereicht; nichts hier wurde
> committed/gepusht, kein Prebuild ausgeführt.
>
> **Kernergebnis:** Alle sicher umsetzbaren Fixes zu diesen vier Empfehlungen
> wurden bereits in früheren Sessions implementiert und sind im aktuellen
> Stand (vc33) live: R8-Vollmodus + Resource-Shrinking (an), ML-Kit-Scanner-
> Orientierung entsperrt (Commit `2b4bb18`). Für vc34 gibt es **keine weitere
> risikofreie Code-Änderung** — die verbleibenden Punkte stecken alle in
> Fremd-Bibliotheken bzw. sind durch Expo SDK 57 / fehlende AGP-9-Unterstützung
> blockiert. Details je Empfehlung unten.
>
> Verifikation Basis-Stand: `npx tsc --noEmit` = 0 Fehler; Arbeitsbaum ohne
> modifizierten Quellcode (nur diese Doku neu). jest/eslint-Baseline zuletzt
> grün auf Commit `b07d01e` (jest 978 grün, eslint 0).

---

## 1. Veraltete Edge-to-Edge-APIs (Android 15 deprecated)

**Geflaggte Stellen (Play Console):** `getStatusBarColor` / `setStatusBarColor`
/ `setNavigationBarColor` in `penfeizhou.animation.apng`,
`facebook.imageutils.BitmapUtil`, `bumptech.glide`.

**Ursache — exakt lokalisiert:**
- **Glide (`com.bumptech.glide` 5.0.5)** und der **APNG-Decoder
  (`com.github.penfeizhou.android.animation:glide-plugin:3.0.5`)** kommen beide
  aus **`expo-image`** — die Versionen sind in
  `node_modules/expo-image/android/build.gradle` **fest verdrahtet**
  (`def GLIDE_VERSION = "5.0.5"` + die penfeizhou-glide-plugin-Zeile). Nicht aus
  `react-native-android-widget` — dessen `android/build.gradle` nutzt nur
  `com.caverock:androidsvg-aar:1.4`, kein Glide/penfeizhou (verifiziert).
- **`facebook.imageutils.BitmapUtil`** = **Fresco**, Teil des **React-Native-
  0.86-Cores** (RN nutzt Fresco für sein natives Image-Pipeline).
- **Kein App-Code** ruft diese APIs auf: `grep` über `src/ modules/ plugins/`
  nach `setStatusBarColor|getStatusBarColor|setNavigationBarColor` = **leer**.
  Es ist ausschließlich kompilierter Fremd-Bibliotheks-Bytecode.

**Ist-Stand:** `edgeToEdgeEnabled=true` ist bereits gesetzt
(`android/gradle.properties` Z. 47). Es handelt sich um **Deprecation-Warnungen,
keine Fehler** — die Methoden funktionieren weiter; im aktivierten Edge-to-Edge-
Modus sind sie ohnehin wirkungslos (No-Op).

**Gibt es eine neuere, sichere Dependency-Version?** Nein.
- `expo-image` installiert: **57.0.1**. npm-dist-tags: `latest` **und** `next`
  zeigen beide auf **57.0.1** — das ist die **neueste** expo-image für Expo
  SDK 57. Keinen Patch-Bump verfügbar, der Glide/penfeizhou anhebt.
- Glide **einzeln** hochziehen (via `resolutionStrategy.force`) ist **nicht
  sicher**: Glide 5.0.5, `glide:ksp`, `avif-integration`, `okhttp3-integration`
  und das penfeizhou-glide-plugin sind in expo-image als **aufeinander
  abgestimmtes Set** gepinnt — ein isolierter Version-Override riskiert
  KSP-/Integrations-Inkompatibilität und damit einen **Build- oder
  Laufzeit-Bruch**, der erst am Gerät auffällt. Genau das soll für vc34
  vermieden werden.
- Der einzige echte Pfad zu neuerem Glide/Fresco ist ein **Bump des gesamten
  Expo SDK (→ 58) bzw. RN-Core** — ein Major-Upgrade, das den Build umbaut und
  brechen kann. Klar außerhalb des sicheren Rahmens für vc34.

**Fix?** **Nein — nicht app-fixbar.** Upstream-Problem in expo-image (Glide/
penfeizhou) und RN-Core (Fresco). Beide Libs sind bereits auf der neuesten für
SDK 57 verfügbaren Version. Warnung ist nicht funktionsbrechend.

---

## 2. Orientierungs-/Resize-Einschränkung (Android 16 große Displays)

**Geflaggt:** `android:screenOrientation="portrait"` auf **MainActivity** und
**WidgetConfigurationActivity** (`android/app/src/main/AndroidManifest.xml`,
Z. 57 bzw. Z. 47).

**Ursache:** Android 16 ignoriert Orientierungs-/Resize-Sperren auf großen
Displays (>600 dp) bei targetSdk 36 (Expo SDK 57).

**Bereits umgesetzt (frühere Session, Commit `2b4bb18`):** Die von ML Kits
Barcode-Scanner-AAR fest vorgegebene Portrait-Sperre auf
`com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity`
wurde per Manifest-Merger-Override entfernt
(`tools:node="merge" tools:remove="android:screenOrientation"`, Manifest Z.
140–141), ohne die Third-Party-AAR zu patchen.
**Verifiziert im gemergten Release-Manifest:** diese Activity hat dort
**kein** `screenOrientation` mehr (nur noch `android:exported="false"`).

**Warum die beiden verbleibenden Activities NICHT entsperrt werden:**
- **MainActivity** — die gesamte App-UI ist bewusst Portrait
  (`app.config` `orientation:'portrait'`) und war **nie für Querformat/Tablet
  designt/getestet**. Sperre entfernen = konkrete **Layout-Regression auf
  Phones**. Nicht geändert (entspricht der Vorgabe „nur was KEINE Regression
  riskiert").
- **WidgetConfigurationActivity** — Portrait dient hier der **Crash-
  Vermeidung**: ein RN-Activity-Recreate mit non-null `savedInstanceState` ist
  ein bekannter Crash-Vektor; die Activity spiegelt bewusst MainActivitys
  Portrait + `configChanges`. Ausführlich im Manifest kommentiert (Z. 38–46).
  Freigeben würde den RN-Config-Screen auf Tablets im ungetesteten Querformat
  rendern. Nicht geändert.

**Option `android:resizeableActivity` geprüft:** Bringt hier nichts Sicheres.
Bei targetSdk 36 / Android 16 werden Orientierungs- **und** Resize-
Beschränkungen auf großen Displays ohnehin ignoriert; `resizeableActivity=false`
ist selbst deprecated und wird nicht mehr honoriert. Es gibt **kein
Manifest-Attribut**, das gleichzeitig die Empfehlung erfüllt **und** die
Phone-Layout-Regression verhindert.

**Fix?** **Teilweise — bereits erledigt** (1 von 3 geflaggten Activities real
entsperrt). Der Rest braucht eine **echte responsive/Tablet-UI** (großer
Design-Aufwand, eigene Session) — bewusst zurückgestellt, dokumentiert.

---

## 3. Bitmap-Bildoptimierung (Glide/Fresco manuelles Decodieren)

**Ursache:** Warnung betrifft die **Interna** derselben Libs wie Punkt 1:
Glides Downsampler (aus expo-image) und Frescos `BitmapUtil` (aus RN-Core).
`react-native-android-widget` nutzt kein Glide/Fresco (nur androidsvg,
verifiziert), scheidet als Quelle aus.

**Ist-Stand app-seitig:** Die App lädt Bilder bereits durchgängig über
**`expo-image`** (Glide-basiert, inkl. `CustomDownsampleStrategy` — Datei in
`node_modules/expo-image/.../CustomDownsampleStrategy.kt` vorhanden, d. h.
Downsampling/Caching aktiv). **Kein App-Code** decodiert Bitmaps manuell
(`BitmapFactory`/manuelles Decode im App-Quellcode nicht vorhanden — es ist eine
RN/JS-App ohne eigenen nativen Bild-Decode-Pfad).

**Fix?** **Nein — nicht app-fixbar.** Der Hinweis zielt auf Bibliotheks-Interna
(Glide/Fresco). App macht bereits alles richtig (expo-image mit Downsampling).
expo-image auf neuester SDK-57-Version (57.0.1).

---

## 4. R8-Optimierung + AGP 9.0

**Ist-Stand R8 (unter AGP 8, aktueller Stand):**
- `android.enableMinifyInReleaseBuilds=true` **und**
  `android.enableShrinkResourcesInReleaseBuilds=true` sind gesetzt
  (`android/gradle.properties` Z. 69–70). In `app/build.gradle` greifen
  `minifyEnabled` + `shrinkResources` entsprechend (Z. 127–130).
- Laut früherer Bundle-Explorer-Prüfung (vc6+) sind **R8-Vollmodus** und
  **Entfernung von Ressourcen** damit **AN**. Die zwei restlichen Punkte
  („Optimierte Entfernung von Ressourcen", „Klassen neu bündeln") sind laut
  Google erst **ab AGP 9.0** verfügbar.

**AGP 9.0 — dokumentierter, empirisch verifizierter Blocker (unverändert):**
Zwei harte, in früheren Sessions reproduzierte Blocker; **kein neuer Test
nötig**, Stand bestätigt:
1. `app/build.gradle` Z. 2 wendet `org.jetbrains.kotlin.android` an → kollidiert
   mit AGP 9s **eingebautem** Kotlin-Support
   („extension already registered with name 'kotlin'"). Dieses Plugin setzt
   Expos Prebuild-Template.
2. Der **Windows-CMake-Pfadlängen-Workaround** in `android/build.gradle`
   (Z. 48–65) ruft `androidComponents.finalizeDsl {}` **innerhalb** eines
   `plugins.withId {}`-Hooks — AGP 9 lehnt das ab
   („It is too late to call finalizeDsl"). AGP 9 hat diesen Erweiterungspunkt
   geschlossen; der Workaround (nötig gegen das 250-Zeichen-
   `CMAKE_OBJECT_PATH_MAX`-Limit bei tief verschachtelten pnpm-Paketen) müsste
   auf einen anderen Mechanismus umgebaut werden (z. B. Windows-`subst` statt
   AGP-DSL-Manipulation).

AGP 9 wird von **Expo SDK 57 nicht unterstützt**; die AGP-Version kommt aus dem
Expo-Root-Template. In früheren Sessions sauber zurückgerollt, kein Diff.
**Nicht angefasst** (Änderung würde den Build brechen).

**Anmerkung `proguard-android.txt` vs. `-optimize`:** `app/build.gradle` Z. 130
nutzt `getDefaultProguardFile("proguard-android.txt")`. Ein Wechsel auf
`proguard-android-optimize.txt` wurde **bewusst nicht** vorgenommen — das ändert
das R8-Optimierungsverhalten und kann bei minifizierungsempfindlichen nativen
Libs (whisper.rn, llama.rn, Glide+KSP) zu **erst am Gerät sichtbaren**
Laufzeit-Crashes führen (tsc/jest fangen das nicht). Zu riskant für vc34 direkt
nach vc33-Einreichung.

**Fix?** **Nein — Blocker bestätigt.** R8 ist unter AGP 8 maximal konfiguriert.
Die restlichen Optimierungen brauchen AGP 9.0, das Expo SDK 57 nicht trägt.
Wartet auf Expo-SDK-Version mit AGP-9-Unterstützung.

---

## Zusammenfassung

| # | Empfehlung | Status vc34 | Wo/Warum |
|---|---|---|---|
| 1 | Edge-to-Edge deprecated APIs | **Nicht fixbar** | Glide/penfeizhou (expo-image, bereits neueste 57.0.1) + Fresco (RN-Core); kein App-Code betroffen; nur Warnung |
| 2 | Orientierungs-Sperre | **Teilweise erledigt** | ML-Kit-Scanner bereits entsperrt (`2b4bb18`, im Merge verifiziert); MainActivity/WidgetConfig bleiben Portrait (Phone-Regression bzw. RN-Crash-Schutz); Rest = Tablet-UI-Arbeit |
| 3 | Bitmap-Optimierung | **Nicht fixbar** | Glide/Fresco-Interna; App nutzt bereits expo-image mit Downsampling; kein manuelles Decode im App-Code |
| 4 | R8 + AGP 9.0 | **Blocker bestätigt** | R8 unter AGP 8 max. an (Vollmodus+Shrink); Rest braucht AGP 9.0 → 2 harte Blocker (Kotlin-Plugin-Kollision + finalizeDsl-Restriktion), Expo SDK 57 trägt AGP 9 nicht |

**Diese Session real umgesetzt (neu):** nichts am Code — alle sicheren Fixes
waren bereits live. Neu ist nur diese Analyse-Datei.
**Verifiziert:** `tsc --noEmit` = 0; Arbeitsbaum ohne Quellcode-Änderung; die
Faktenbelege oben (Dependency-Herkunft, gemergtes Manifest, npm-dist-tags,
gradle.properties-Flags) stammen aus Tool-Output dieser Session.
