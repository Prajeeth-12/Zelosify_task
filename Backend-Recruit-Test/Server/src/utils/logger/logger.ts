/**
 * Structured JSON Logger
 * ======================
 * Replaces raw `console.log` / `console.error` throughout the backend.
 *
 * Every log line is a single JSON object with at least:
 *   { timestamp, level, message }
 * Optional fields: tenantId, meta (arbitrary payload).
 *
 * Usage:
 *   import { logger } from "../../utils/logger/logger.js";
 *   logger.info("Server started", { port: 5000 });
 *   logger.error("Query failed", { tenantId: "abc", meta: { err } });
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  tenantId?: string;
  meta?: Record<string, unknown>;
}

interface LogOptions {
  /** Optional tenant context for multi-tenant tracing */
  tenantId?: string;
  /** Arbitrary key-value payload */
  meta?: Record<string, unknown>;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function buildEntry(
  level: LogLevel,
  message: string,
  opts?: LogOptions
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (opts?.tenantId) entry.tenantId = opts.tenantId;
  if (opts?.meta && Object.keys(opts.meta).length > 0) entry.meta = opts.meta;
  return entry;
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === "ERROR") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const logger = {
  debug(message: string, opts?: LogOptions): void {
    emit(buildEntry("DEBUG", message, opts));
  },

  info(message: string, opts?: LogOptions): void {
    emit(buildEntry("INFO", message, opts));
  },

  warn(message: string, opts?: LogOptions): void {
    emit(buildEntry("WARN", message, opts));
  },

  error(message: string, opts?: LogOptions): void {
    emit(buildEntry("ERROR", message, opts));
  },
};
