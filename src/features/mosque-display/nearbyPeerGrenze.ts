/**
 * F15: Android Nearby Connections / iOS Multipeer — bewusste Grenze.
 * Caption-Teilen läuft über LAN-HTTP+SSE (captionShareServer); kein Google Play
 * Services Nearby-Dependency (Kosten/Review/Data-Safety). iOS Multipeer erfordert
 * eigenes natives Modul — nicht in Expo-Scope dieser QA-Runde.
 */
export const NEARBY_PEER_STATUS = 'Grenze' as const;

export const NEARBY_PEER_REASON_DE =
  'App-Zuhörer im gleichen WLAN über QR/SSE; für Hotspot-only: Handy-Hotspot starten (Anleitung im Browser-Teilen). Nearby/Multipeer: nicht angebunden — nur LAN.';