// Metro-Alias fuer expo/src/winter/AbortSignal — Hermes ohne globales AbortSignal.
type AbortSignalConstructor = typeof AbortSignal;

const MAX_TIMEOUT = Number.MAX_SAFE_INTEGER;
const MAX_TIMER_DELAY = 2 ** 31 - 1;

export function installAbortSignalPatch(
  abortSignal: AbortSignalConstructor | undefined
): AbortSignalConstructor | undefined {
  if (abortSignal == null) return abortSignal;
  if (abortSignal.timeout == null) {
    defineAbortSignalStatic(abortSignal, 'timeout', timeout);
  }
  if (abortSignal.any == null) {
    defineAbortSignalStatic(abortSignal, 'any', anySignals);
  }
  return abortSignal;
}

function timeout(milliseconds: number): AbortSignal {
  validateTimeout(milliseconds);
  const controller = new AbortController();
  const reason = new DOMException('The signal timed out.', 'TimeoutError');
  let remaining = milliseconds;
  const schedule = () => {
    const delay = Math.min(remaining, MAX_TIMER_DELAY);
    remaining -= delay;
    setTimeout(() => {
      if (remaining > 0) schedule();
      else controller.abort(reason);
    }, delay);
  };
  schedule();
  return controller.signal;
}

function anySignals(signals: Iterable<AbortSignal>): AbortSignal {
  if (signals == null || typeof signals[Symbol.iterator] !== 'function') {
    throw new TypeError('AbortSignal.any requires an iterable.');
  }
  const signalList = Array.from(signals);
  const controller = new AbortController();
  for (const signal of signalList) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
  }
  const cleanups: (() => void)[] = [];
  for (const signal of signalList) {
    const listener = () => {
      cleanups.forEach((c) => c());
      controller.abort(signal.reason);
    };
    signal.addEventListener('abort', listener);
    cleanups.push(() => signal.removeEventListener('abort', listener));
  }
  return controller.signal;
}

function validateTimeout(milliseconds: number): void {
  if (typeof milliseconds !== 'number' || !Number.isInteger(milliseconds) || milliseconds < 0) {
    throw new RangeError('AbortSignal.timeout requires a non-negative integer.');
  }
  if (milliseconds > MAX_TIMEOUT) {
    throw new RangeError(`AbortSignal.timeout max ${MAX_TIMEOUT}.`);
  }
}

function defineAbortSignalStatic(
  abortSignal: AbortSignalConstructor,
  name: 'timeout' | 'any',
  value: AbortSignalConstructor[typeof name]
): void {
  Object.defineProperty(abortSignal, name, {
    value,
    configurable: true,
    enumerable: false,
    writable: true,
  });
}
