const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

type Level = keyof typeof LEVELS;
type Meta = Record<string, unknown>;

const configured = (process.env["LOG_LEVEL"] ?? "info") as Level;
const threshold = LEVELS[configured] ?? LEVELS.info;
const asJson = process.env["NODE_ENV"] === "production";

function emit(level: Level, message: string, meta?: Meta): void {
  if (LEVELS[level] < threshold) return;

  const sink = level === "error" || level === "warn" ? console.error : console.log;

  if (asJson) {
    sink(JSON.stringify({ level, time: new Date().toISOString(), message, ...meta }));
    return;
  }

  const suffix = meta !== undefined && Object.keys(meta).length > 0
    ? ` ${JSON.stringify(meta)}`
    : "";
  sink(`[${level}] ${message}${suffix}`);
}

export const logger = {
  debug: (message: string, meta?: Meta) => emit("debug", message, meta),
  info: (message: string, meta?: Meta) => emit("info", message, meta),
  warn: (message: string, meta?: Meta) => emit("warn", message, meta),
  error: (message: string, meta?: Meta) => emit("error", message, meta),
};
