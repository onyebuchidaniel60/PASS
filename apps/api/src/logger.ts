import { env } from "./env.js";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Minimal structured logger. Never receives secret material
 * (docs/SECURITY_SPEC.md §16); callers must not log keys or tokens.
 */
export function createLogger(scope: string) {
  const threshold = ORDER[env().LOG_LEVEL] ?? ORDER.info;

  function emit(level: Level, msg: string, data?: Record<string, unknown>) {
    if (ORDER[level] < threshold) return;
    const line = {
      ts: new Date().toISOString(),
      level,
      scope,
      msg,
      ...(data ?? {}),
    };
    const out = level === "error" ? console.error : console.log;
    out(JSON.stringify(line));
  }

  return {
    debug: (m: string, d?: Record<string, unknown>) => emit("debug", m, d),
    info: (m: string, d?: Record<string, unknown>) => emit("info", m, d),
    warn: (m: string, d?: Record<string, unknown>) => emit("warn", m, d),
    error: (m: string, d?: Record<string, unknown>) => emit("error", m, d),
    child: (sub: string) => createLogger(`${scope}.${sub}`),
  };
}

export type Logger = ReturnType<typeof createLogger>;