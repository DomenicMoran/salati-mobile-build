# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# llama.rn (native On-Device-KI, siehe src/features/ki) — von der README
# empfohlene Regel, verhindert dass R8 die JNI-Bridge-Klassen wegoptimiert.
# HINWEIS: diese Datei wird von `npx expo prebuild` beim naechsten Clean-
# Regenerate ueberschrieben — nach jedem Prebuild pruefen/neu einfuegen.
-keep class com.rnllama.** { *; }

# whisper.rn (native Hifz-Spracherkennung, siehe src/features/hifz) — dieselbe
# Begruendung wie bei com.rnllama.**: whisper.rn liefert KEINE Consumer-ProGuard-
# Regeln mit, R8 (Full-Mode ist AGP-8-Default) wuerde die per JNI referenzierten
# Bridge-Klassen wegoptimieren. Folge waere: Spracherkennung laeuft im Debug-
# Build, faellt im minifizierten Release-Build aus.
# HINWEIS: siehe Prebuild-Warnung oben — nach jedem Prebuild pruefen/neu einfuegen.
-keep class com.rnwhisper.** { *; }

# @kesha-antonov/react-native-background-downloader (KI-Modell-Hintergrund-
# Download, com.eko.*) referenziert Tencent-MMKV NUR optional
# (StorageManager: "Uses MMKV when available, falls back to SharedPreferences").
# MMKV ist nicht gebundelt → ohne diese Regel bricht R8 (minifyReleaseWithR8)
# mit "Missing class com.tencent.mmkv.MMKV" ab. Zur Laufzeit greift der
# SharedPreferences-Fallback, daher genügt -dontwarn (kein -keep nötig).
-dontwarn com.tencent.mmkv.**

# Add any project specific keep options here:
