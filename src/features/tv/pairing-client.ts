// Handy-Seite der LAN-Kopplung Handy↔Salati-TV (Gegenstück zu apps/tv/src/lib/
// pairing.ts). Der TV öffnet einen lokalen TCP-Server und zeigt einen QR-Code
// (salatitv://pair?host=..&port=..&token=..); dieses Modul verbindet sich direkt
// im selben WLAN, macht den Handshake und schickt danach Fernbedienungs- und
// Quiz-Kommandos. KEIN Backend, keine Cloud — rein lokal.
//
// Protokoll (zeilengetrennte JSON-Objekte):
//   Handy → TV:  { t:'hello', token }
//                { t:'nav', screen }                 Screen umschalten
//                { t:'key', dir:'up'|'down'|'left'|'right'|'select'|'back' }
//                { t:'quiz', action:'answer', option }
//                { t:'einstellungen', location, is24h, highLatitude, offsets }
//                     Rechenparameter — wird nach dem 'welcome' automatisch
//                     einmal geschickt (siehe tvSyncNutzlast).
//   TV → Handy:  { t:'welcome', name, screens? }   screens = Bildschirme des TV
//                { t:'denied' }
//                { t:'quiz', action:'question'|'result'|'end', ... }
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TcpSocket from 'react-native-tcp-socket';

import type { PrayerTimeOffsets } from '@/features/settings/types';

export interface PairTarget {
  host: string;
  port: number;
  token: string;
}

/**
 * Parst die QR-Nutzlast salatitv://pair?host=..&port=..&token=..
 *
 * Die Eingabe kommt aus der KAMERA, ist also beliebig — ein ungültiger Code
 * muss `null` liefern, nicht werfen. `decodeURIComponent` wirft bei kaputter
 * Prozentkodierung (z. B. ein einzelnes "%") einen URIError; der Aufrufer ist
 * der `onBarcodeScanned`-Callback in app/tv-connect.tsx und fängt nichts ab,
 * ein Wurf riss dort also den Scan-Screen mit (Audit 2026-07-27).
 */
export function parsePairPayload(raw: string): PairTarget | null {
  if (!raw || !raw.startsWith('salatitv://pair')) return null;
  const q = raw.slice(raw.indexOf('?') + 1);
  const params: Record<string, string> = {};
  for (const kv of q.split('&')) {
    const [k, v] = kv.split('=');
    if (!k) continue;
    try {
      params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    } catch {
      return null; // kaputte Prozentkodierung — kein gültiger Kopplungs-Code
    }
  }
  const host = params.host;
  const port = Number(params.port);
  const token = params.token;
  if (!host || !Number.isFinite(port) || port <= 0 || !token) return null;
  return { host, port, token };
}

/**
 * Parst die MANUELLE Eingabe: `host:port` plus Code.
 *
 * WARUM ES DAS GIBT: Der Fernseher zeigt unter dem QR-Code seit jeher eine
 * Zeile „Manuell: 192.168.1.50:8787 · Code ABC123" — nur konnte das Handy
 * damit nichts anfangen, es kannte ausschliesslich die Kamera. Wer eine
 * verschmutzte Linse hat, wessen Kamera-Berechtigung abgelehnt ist oder wer zu
 * weit vom Fernseher weg sitzt, um den Code scharf zu bekommen, stand vor einer
 * Sackgasse, obwohl der Fernseher die Angaben gross auf dem Schirm hatte.
 *
 * Grosszuegig beim Format, streng beim Ergebnis: Leerzeichen fallen weg, der
 * Code wird auf Grossbuchstaben normalisiert (der Fernseher zeigt ihn so), und
 * fehlt der Port, gilt der Standard-Port der Kopplung. Was danach keine
 * gueltige Adresse ergibt, liefert `null` — die Eingabe kommt von Hand und ist
 * beliebig.
 */
export const PAIR_DEFAULT_PORT = 8787;

export function parseManualPair(hostEingabe: string, codeEingabe: string): PairTarget | null {
  const roh = (hostEingabe ?? '').trim();
  const token = (codeEingabe ?? '').trim().toUpperCase();
  if (!roh || !token) return null;

  // `host:port` trennen — nur am LETZTEN Doppelpunkt, damit eine IPv6-Adresse
  // nicht mittendrin zerfaellt.
  const teiler = roh.lastIndexOf(':');
  let host = roh;
  let port = PAIR_DEFAULT_PORT;
  if (teiler > 0) {
    const alsZahl = Number(roh.slice(teiler + 1));
    if (Number.isInteger(alsZahl) && alsZahl > 0 && alsZahl <= 65535) {
      host = roh.slice(0, teiler);
      port = alsZahl;
    }
  }
  host = host.trim();
  if (!host) return null;
  // Nur Zeichen, die in einem Hostnamen oder einer IP vorkommen. Ohne das
  // landete ein Tippfehler wie „192.168.1.50 · Code" als Host im Socket.
  if (!/^[a-zA-Z0-9._:-]+$/.test(host)) return null;
  return { host, port, token };
}

/**
 * Nutzlast der Einstellungs-Uebertragung ans TV.
 *
 * Befund `docs/audit-2026-07-27/HANDY-TV-ABGLEICH.md`: der Fernseher zeigte
 * dieselben Gebetszeiten wie das Handy nur, wenn der Nutzer Ort, Methode,
 * Madhab, Hochbreiten-Regel und Minuten-Korrektur auf BEIDEN Geraeten von Hand
 * gleich eingestellt hatte — die Kopplung uebertrug nur Navigation und Quiz.
 *
 * Uebertragen wird ausschliesslich, was in die Zeitrechnung eingeht, plus das
 * Zeitformat. KEINE Sprache: der Fernseher steht in einem anderen Raum und
 * leitet seine Sprache aus dem Geraet ab; sie hier zu ueberschreiben waere ein
 * unerwarteter Nebeneffekt der Kopplung. Die Feldnamen sind exakt die des
 * TV-Stores (`apps/tv/src/lib/settings.ts`), damit dort nichts umgerechnet
 * werden muss.
 */
export function tvSyncNutzlast(settings: {
  location: { lat: number; lon: number; label: string; city?: string; country?: string };
  method: number;
  school: 0 | 1;
  highLatitudeRule: string;
  prayerTimeOffsets: PrayerTimeOffsets;
  timeFormat: '24h' | '12h';
}) {
  return {
    t: 'einstellungen' as const,
    location: {
      lat: settings.location.lat,
      lon: settings.location.lon,
      label: settings.location.label,
      method: settings.method,
      madhab: settings.school === 1 ? ('hanafi' as const) : ('shafi' as const),
    },
    is24h: settings.timeFormat === '24h',
    highLatitude: settings.highLatitudeRule,
    offsets: settings.prayerTimeOffsets,
  };
}

export type TvConnStatus = 'idle' | 'connecting' | 'connected' | 'denied' | 'error';

/** Ein Quiz-Zustand fürs Zweitschirm-Spiel (vom TV gespiegelt). */
export interface TvQuizState {
  index: number;
  total: number;
  question: string;
  options: string[];
  /** gesetzt, sobald der TV das Ergebnis der eigenen Antwort meldet. */
  answered?: { correct: boolean; correctOption: number };
  /** gesetzt am Ende der Runde. */
  final?: { score: number; total: number };
}

type Sock = ReturnType<typeof TcpSocket.connect>;

/**
 * Reaktiver Verbindungs-Client. `connect(target)` verbindet + macht den
 * Handshake; danach spiegeln nav()/key()/answerQuiz() Kommandos an den TV.
 * Der Quiz-Zustand wird für den Zweitschirm live aktualisiert.
 */
export function useTvConnection() {
  const [status, setStatus] = useState<TvConnStatus>('idle');
  const [tvName, setTvName] = useState<string | null>(null);
  // Vom Fernseher gemeldete Bildschirme (Audit 2026-07-28, T14). `null` heisst
  // „nicht gemeldet" — ein aelterer Fernseher schickt das Feld nicht, dann
  // gilt der eigene Katalog aus features/tv/screens.ts.
  const [tvScreens, setTvScreens] = useState<string[] | null>(null);
  const [quiz, setQuiz] = useState<TvQuizState | null>(null);
  const sockRef = useRef<Sock | null>(null);
  const bufRef = useRef('');

  const cleanup = useCallback(() => {
    const s = sockRef.current;
    sockRef.current = null;
    bufRef.current = '';
    if (s) {
      try {
        s.destroy();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus('idle');
    setTvName(null);
    setTvScreens(null);
    setQuiz(null);
  }, [cleanup]);

  const handleLine = useCallback((line: string) => {
    let msg: { t?: string; [k: string]: unknown };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.t === 'welcome') {
      setStatus('connected');
      setTvName(typeof msg.name === 'string' ? msg.name : 'Salati TV');
      // Die Liste kommt ueber ein LAN-Socket, ist also beliebig — nur
      // nicht-leere Strings uebernehmen, sonst nichts (dann greift der
      // eigene Katalog).
      const screens = Array.isArray(msg.screens)
        ? msg.screens.filter((s): s is string => typeof s === 'string' && s.length > 0)
        : [];
      setTvScreens(screens.length > 0 ? screens : null);
      return;
    }
    if (msg.t === 'denied') {
      setStatus('denied');
      cleanup();
      return;
    }
    if (msg.t === 'quiz') {
      if (msg.action === 'question') {
        setQuiz({
          index: Number(msg.index) || 0,
          total: Number(msg.total) || 0,
          question: String(msg.q ?? ''),
          options: Array.isArray(msg.options) ? (msg.options as string[]) : [],
        });
      } else if (msg.action === 'result') {
        setQuiz((prev) =>
          prev
            ? { ...prev, answered: { correct: Boolean(msg.correct), correctOption: Number(msg.correctOption) } }
            : prev,
        );
      } else if (msg.action === 'end') {
        setQuiz((prev) =>
          prev ? { ...prev, final: { score: Number(msg.score) || 0, total: Number(msg.total) || 0 } } : prev,
        );
      }
    }
  }, [cleanup]);

  const send = useCallback((obj: unknown) => {
    const s = sockRef.current;
    if (!s) return;
    try {
      s.write(JSON.stringify(obj) + '\n');
    } catch {
      /* Socket evtl. zu */
    }
  }, []);

  const connect = useCallback(
    (target: PairTarget) => {
      cleanup();
      setStatus('connecting');
      setTvScreens(null);
      setQuiz(null);
      const socket = TcpSocket.connect({ host: target.host, port: target.port }, () => {
        // verbunden → Handshake
        try {
          socket.write(JSON.stringify({ t: 'hello', token: target.token }) + '\n');
        } catch {
          /* ignore */
        }
      });
      sockRef.current = socket;
      socket.on('data', (data) => {
        bufRef.current += typeof data === 'string' ? data : data.toString();
        let idx: number;
        while ((idx = bufRef.current.indexOf('\n')) >= 0) {
          const line = bufRef.current.slice(0, idx).trim();
          bufRef.current = bufRef.current.slice(idx + 1);
          if (line) handleLine(line);
        }
      });
      socket.on('error', () => {
        setStatus((s) => (s === 'denied' ? s : 'error'));
        cleanup();
      });
      socket.on('close', () => {
        setStatus((s) => (s === 'connected' ? 'idle' : s));
        sockRef.current = null;
      });
    },
    [cleanup, handleLine],
  );

  // Beim Verlassen des Screens sauber trennen.
  useEffect(() => cleanup, [cleanup]);

  const api = useMemo(
    () => ({
      nav: (screen: string) => send({ t: 'nav', screen }),
      key: (dir: 'up' | 'down' | 'left' | 'right' | 'select' | 'back') => send({ t: 'key', dir }),
      answerQuiz: (option: number) => send({ t: 'quiz', action: 'answer', option }),
      /** Rechenparameter ans TV schicken (s. tvSyncNutzlast). */
      sendeEinstellungen: (settings: Parameters<typeof tvSyncNutzlast>[0]) =>
        send(tvSyncNutzlast(settings)),
    }),
    [send],
  );

  return { status, tvName, tvScreens, quiz, connect, disconnect, ...api };
}
