import { createTranscribeSerializer } from './transcribeSerializer';

// Verzögertes Promise, das der Test manuell auflöst — simuliert eine laufende
// whisper.rn-transcribe(), ohne echte native Module.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Lässt die Microtask-Queue vollständig leerlaufen (ein setTimeout(0) liegt hinter
// allen anstehenden Microtasks), sodass eingereihte run()-fn() ihre erste Zeile
// wirklich ausgeführt haben, bevor der Test prüft.
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('createTranscribeSerializer', () => {
  it('führt nie zwei Läufe gleichzeitig aus (serialisiert)', async () => {
    const s = createTranscribeSerializer();
    let gleichzeitig = 0;
    let maxGleichzeitig = 0;
    const d1 = deferred<void>();
    const d2 = deferred<void>();

    const fn = (d: ReturnType<typeof deferred<void>>) => async () => {
      gleichzeitig += 1;
      maxGleichzeitig = Math.max(maxGleichzeitig, gleichzeitig);
      await d.promise;
      gleichzeitig -= 1;
      return 'ok';
    };

    const r1 = s.run(fn(d1));
    const r2 = s.run(fn(d2));

    // Beide eingereiht, aber nur der erste läuft.
    await flush();
    expect(maxGleichzeitig).toBe(1);

    d1.resolve();
    await r1;
    // Erst jetzt darf der zweite laufen.
    d2.resolve();
    await r2;

    expect(maxGleichzeitig).toBe(1);
  });

  it('skipIfBusy überspringt, wenn bereits ein Lauf aktiv ist (fn NICHT ausgeführt)', async () => {
    const s = createTranscribeSerializer();
    const d1 = deferred<void>();
    let zweiteAusgefuehrt = false;

    const r1 = s.run(async () => {
      await d1.promise;
      return 'erster';
    });

    const r2 = await s.run(
      async () => {
        zweiteAusgefuehrt = true;
        return 'zweiter';
      },
      { skipIfBusy: true },
    );

    expect(r2.skipped).toBe(true);
    expect(r2.value).toBeUndefined();
    expect(zweiteAusgefuehrt).toBe(false);

    d1.resolve();
    const res1 = await r1;
    expect(res1).toEqual({ skipped: false, value: 'erster' });
  });

  it('ohne skipIfBusy reiht sich der Final-Lauf hinter einen aktiven Lauf ein (wird nicht verworfen)', async () => {
    const s = createTranscribeSerializer();
    const d1 = deferred<void>();
    const reihenfolge: string[] = [];

    const rTick = s.run(async () => {
      await d1.promise;
      reihenfolge.push('tick');
      return 'tick';
    });
    const rFinal = s.run(async () => {
      reihenfolge.push('final');
      return 'final';
    });

    d1.resolve();
    const [tick, fin] = await Promise.all([rTick, rFinal]);

    expect(tick).toEqual({ skipped: false, value: 'tick' });
    expect(fin).toEqual({ skipped: false, value: 'final' });
    expect(reihenfolge).toEqual(['tick', 'final']);
  });

  it('istBesetzt spiegelt aktive/eingereihte Läufe', async () => {
    const s = createTranscribeSerializer();
    expect(s.istBesetzt()).toBe(false);
    const d1 = deferred<void>();
    const r1 = s.run(async () => {
      await d1.promise;
      return 1;
    });
    expect(s.istBesetzt()).toBe(true);
    d1.resolve();
    await r1;
    expect(s.istBesetzt()).toBe(false);
  });

  it('ein Fehler in einem Lauf bricht die Kette nicht ab', async () => {
    const s = createTranscribeSerializer();
    const r1 = s.run(async () => {
      throw new Error('boom');
    });
    await expect(r1).rejects.toThrow('boom');

    // Nachfolgender Lauf muss trotzdem sauber durchlaufen.
    const r2 = await s.run(async () => 'weiter');
    expect(r2).toEqual({ skipped: false, value: 'weiter' });
    expect(s.istBesetzt()).toBe(false);
  });

  it('leerlauf() wartet, bis kein Lauf mehr aktiv ist', async () => {
    const s = createTranscribeSerializer();
    const d1 = deferred<void>();
    let fertig = false;
    const r1 = s.run(async () => {
      await d1.promise;
      fertig = true;
      return 1;
    });

    const leer = s.leerlauf();
    let leerlaufFertig = false;
    leer.then(() => {
      leerlaufFertig = true;
    });

    await flush();
    expect(leerlaufFertig).toBe(false);

    d1.resolve();
    await r1;
    await leer;
    expect(fertig).toBe(true);
    expect(s.istBesetzt()).toBe(false);
  });
});
