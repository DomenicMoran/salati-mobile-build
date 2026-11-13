import TcpSocket from 'react-native-tcp-socket';
import * as Network from 'expo-network';

import {
  buildCaptionHtml,
  CAPTION_HTTP_PORT,
  httpHtmlResponse,
  httpNotFound,
  parseHttpRequestPath,
} from './captionHttp';

type Server = ReturnType<typeof TcpSocket.createServer>;

let server: Server | null = null;
let captionText = '';
let meta = { title: 'Khutba live', disclaimer: '' };

export function setCaptionShareState(text: string, title: string, disclaimer: string) {
  captionText = text;
  meta = { title, disclaimer };
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

export async function startCaptionShareServer(): Promise<void> {
  if (server) return;
  server = TcpSocket.createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += typeof chunk === 'string' ? chunk : chunk.toString();
      if (!buf.includes('\r\n\r\n')) return;
      const path = parseHttpRequestPath(buf);
      const html =
        path === '/' || path === '/khutba'
          ? buildCaptionHtml({
              title: meta.title,
              caption: captionText,
              disclaimer: meta.disclaimer,
            })
          : null;
      try {
        socket.write(html ? httpHtmlResponse(html) : httpNotFound());
      } catch {
        /* ignore */
      }
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server!.on('error', reject);
    server!.listen({ port: CAPTION_HTTP_PORT, host: '0.0.0.0' }, () => resolve());
  });
}

export function stopCaptionShareServer(): void {
  if (!server) return;
  try {
    server.close();
  } catch {
    /* ignore */
  }
  server = null;
}
