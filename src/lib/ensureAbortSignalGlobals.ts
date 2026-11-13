/**
 * Hermes startet oft ohne globales AbortSignal. expo/src/winter wird per
 * Metro *vor* dem App-Entry ausgeführt (getModulesRunBeforeMainModule) — ein
 * Polyfill nur in index.android.js kommt zu spät.
 */
function needsAbortGlobals(): boolean {
  return (
    typeof globalThis.AbortSignal === 'undefined' ||
    globalThis.AbortSignal == null ||
    typeof globalThis.AbortController === 'undefined' ||
    globalThis.AbortController == null
  );
}

function installMinimalAbortGlobals(): void {
  class AbortSignalPolyfill {
    aborted = false;
    reason: unknown;
    addEventListener(): void {}
    removeEventListener(): void {}
  }

  class AbortControllerPolyfill {
    readonly signal = new AbortSignalPolyfill();
    abort(reason?: unknown): void {
      this.signal.aborted = true;
      this.signal.reason = reason;
    }
  }

  globalThis.AbortSignal = AbortSignalPolyfill as unknown as typeof AbortSignal;
  globalThis.AbortController = AbortControllerPolyfill as unknown as typeof AbortController;
}

if (needsAbortGlobals()) {
  installMinimalAbortGlobals();
}
