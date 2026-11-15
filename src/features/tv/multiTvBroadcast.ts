/** Kurzlebige LAN-Sends an mehrere registrierte TVs (kein Cloud-Relay). */
import TcpSocket from 'react-native-tcp-socket';

import type { RegisteredTv } from './tvPairingRegistry';

function writeJsonLine(host: string, port: number, token: string, msg: unknown): Promise<'ok' | 'err'> {
  return new Promise((resolve) => {
    let buf = '';
    const socket = TcpSocket.connect({ host, port }, () => {
      try {
        socket.write(`${JSON.stringify({ t: 'hello', token })}\n`);
      } catch {
        resolve('err');
      }
    });
    const finish = (ok: boolean) => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(ok ? 'ok' : 'err');
    };
    socket.on('data', (chunk) => {
      buf += typeof chunk === 'string' ? chunk : chunk.toString();
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as { t?: string };
          if (parsed.t === 'welcome') {
            try {
              socket.write(`${JSON.stringify(msg)}\n`);
            } catch {
              finish(false);
              return;
            }
            finish(true);
            return;
          }
          if (parsed.t === 'denied') finish(false);
        } catch {
          finish(false);
        }
      }
    });
    socket.on('error', () => finish(false));
    setTimeout(() => finish(false), 4000);
  });
}

export async function broadcastToTvs(tvs: RegisteredTv[], msg: unknown): Promise<Record<string, 'ok' | 'err'>> {
  const out: Record<string, 'ok' | 'err'> = {};
  await Promise.all(
    tvs.map(async (tv) => {
      const id = `${tv.host}:${tv.port}`;
      if (!tv.token) {
        out[id] = 'err';
        return;
      }
      out[id] = await writeJsonLine(tv.host, tv.port, tv.token, msg);
    }),
  );
  return out;
}