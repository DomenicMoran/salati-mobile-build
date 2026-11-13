/**
 * Ersetzt expo/src/winter/index in getModulesRunBeforeMainModule: zuerst AbortSignal,
 * dann dieselbe Runtime wie Expo (runtime.native).
 */
import './expoWinterRuntime.native.shim';
