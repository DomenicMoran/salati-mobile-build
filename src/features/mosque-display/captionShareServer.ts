import TcpSocket from 'react-native-tcp-socket';
import type Socket from 'react-native-tcp-socket/lib/types/Socket';
import * as Network from 'expo-network';

import {
  buildCaptionHtml,
  buildSseEvent,
  CAPTION_HTTP_PORT,
  CAPTION_SSE_PATH,
  captionPayloadJson,
  httpHtmlResponse,
  httpNotFound,
  httpSsePreamble,
  nextCaptionEventId,
  parseHttpQuery,
  parseHttpRequestPath,
  type CaptionSharePayload,
} from './captionHttp';

type Server = ReturnType<typeof TcpSocket.createServer>;

let server: Server | null = null;
let payload: CaptionSharePayload = {
  title: 'Khutba live',
  caption: '',
  disclaimer: '',
  updatedAt: Date.now(),
};
const sseClients = new Set<Socket>();

const HOTSPOT_HINT_DE =
  'Kein gemeinsames WLAN? Handy-Hotspot starten, TV und Zuhörer-Geräte verbinden, dann QR erneut scannen.';

export function setCaptionShareState(text: string, title: string, disclaimer: string, langs?: CaptionSharePayload['langs']) {
  payload = {
    title,
    caption: text,
    disclaimer,
    updatedAt: Date.now(),
    langs,
  };
  broadcastCaption();
}

function broadcastCaption(): void {
  const body = buildSseEvent('caption', captionPayloadJson(payload), nextCaptionEventId());
  for (const sock of [...sseClients]) {
    try {
      sock.write(body);
    } catch {
      sseClients.delete(sock);
      try {
        sock.destroy();
      } catch {
        /* ignore */
      }
    }
  }
}

export async function resolveShareHost(): Promise<string | null> {
  try {
    const ip = await Network.getIpAddressAsync();
    if (ip && ip !== '0.0.0.0' && !ip.startsWith('127.')) return ip;
  } catch {
    /* ignore */
  }
  return null;
}

export function captionShareUrl(host: string): string {
  return `http://${host}:${CAPTION_HTTP_PORT}/`;
}

export function isCaptionShareRunning(): boolean {
  return server !== null;
}

export function getCaptionSharePayload(): CaptionSharePayload {
  return payload;
}

function handleHttp(socket: Socket, raw: string): void {
  const path = parseHttpRequestPath(raw);
  if (path === CAPTION_SSE_PATH || path === '/stream') {
    try {
      socket.write(httpSsePreamble());
      socket.write(buildSseEvent('caption', captionPayloadJson(payload), nextCaptionEventId()));
      sseClients.add(socket);
      socket.on('close', () => sseClients.delete(socket));
      socket.on('error', () => sseClients.delete(socket));
    } catch {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    }
    return;
  }
  if (path === '/' || path === '/khutba') {
    parseHttpQuery(raw);
    const html = buildCaptionHtml({
      title: payload.title,
      caption: payload.caption,
      disclaimer: payload.disclaimer,
      hotspotHint: HOTSPOT_HINT_DE,
    });
    try {
      socket.write(httpHtmlResponse(html));
    } catch {
      /* ignore */
    }
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    socket.write(httpNotFound());
    socket.destroy();
  } catch {
    /* ignore */
  }
}

export async function startCaptionShareServer(): Promise<void> {
  if (server) return;
  server = TcpSocket.createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += typeof chunk === 'string' ? chunk : chunk.toString();
      if (!buf.includes('\r\n\r\n')) return;
      handleHttp(socket, buf);
      buf = '';
    });
  });
  await new Promise<void>((resolve, reject) => {
    server!.on('error', reject);
    server!.listen({ port: CAPTION_HTTP_PORT, host: '0.0.0.0' }, () => resolve());
  });
}

export function stopCaptionShareServer(): void {
  for (const sock of [...sseClients]) {
    try {
      sock.destroy();
    } catch {
      /* ignore */
    }
  }
  sseClients.clear();
  if (!server) return;
  try {
    server.close();
  } catch {
    /* ignore */
  }
  server = null;
}