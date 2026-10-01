/**
 * Journal de débogage : les erreurs sont toujours enregistrées ; les traces détaillées (appels d'API,
 * outils de Claude, étapes de génération) seulement quand le mode debug est activé (menu Compte).
 * Gardé en mémoire (500 lignes) et dans DATA_DIR/logs/debug.log (tourne à 1 Mo), pour pouvoir copier
 * un rapport complet après un incident.
 */
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const LOG_DIR = path.join(DATA_DIR, "logs");
const LOG_FILE = path.join(LOG_DIR, "debug.log");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const MAX_ENTRIES = 500;
const MAX_FILE_BYTES = 1_000_000;

export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogEntry {
  at: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

// État partagé entre les routes (le build Next peut charger ce module plusieurs fois).
const g = globalThis as unknown as { __dofusLog?: { entries: LogEntry[]; enabled: boolean | null } };
const state = (g.__dofusLog ??= { entries: [], enabled: null });

/** Retire clés, jetons, mots de passe et cookies des données journalisées. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "…";
  if (typeof value === "string") {
    return value
      .replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-***")
      .replace(/(password|motdepasse|authorization|cookie|api[_-]?key|x-api-key)(["':=\s]+)[^\s"',}]+/gi, "$1$2***")
      .slice(0, 1500);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = /pass|secret|token|cookie|authorization|api.?key/i.test(k) ? "***" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export async function isDebugEnabled(): Promise<boolean> {
  if (state.enabled === null) {
    try {
      state.enabled = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8")).debug === true;
    } catch {
      state.enabled = process.env.DEBUG_LOG === "true";
    }
  }
  return state.enabled;
}

export async function setDebugEnabled(enabled: boolean): Promise<void> {
  state.enabled = enabled;
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
  } catch {
    // pas encore de fichier de réglages
  }
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify({ ...settings, debug: enabled }, null, 2) + "\n");
  log("info", "debug", enabled ? "Mode debug activé" : "Mode debug désactivé");
}

async function appendToFile(line: string): Promise<void> {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    const stat = await fs.stat(LOG_FILE).catch(() => null);
    if (stat && stat.size > MAX_FILE_BYTES) await fs.rename(LOG_FILE, `${LOG_FILE}.1`);
    await fs.appendFile(LOG_FILE, line + "\n");
  } catch {
    // le journal ne doit jamais faire échouer l'application
  }
}

/** Enregistre une ligne. Les niveaux `debug` ne sont gardés que si le mode debug est actif. */
export function log(level: LogLevel, scope: string, message: string, data?: unknown): void {
  if (level === "debug" && state.enabled !== true) return;
  const entry: LogEntry = { at: new Date().toISOString(), level, scope, message: String(redact(message)), data: data === undefined ? undefined : redact(data) };
  state.entries.push(entry);
  if (state.entries.length > MAX_ENTRIES) state.entries.splice(0, state.entries.length - MAX_ENTRIES);
  void appendToFile(formatEntry(entry));
}

export function formatEntry(e: LogEntry): string {
  const data = e.data === undefined ? "" : ` ${JSON.stringify(e.data)}`;
  return `${e.at} ${e.level.toUpperCase().padEnd(5)} [${e.scope}] ${e.message}${data}`;
}

export function recentLogs(limit = MAX_ENTRIES): LogEntry[] {
  return state.entries.slice(-limit);
}

export function clearLogs(): void {
  state.entries.length = 0;
}

/** Texte complet à coller dans une conversation : contexte + journal (aucun secret). */
export async function buildReport(): Promise<string> {
  const head = [
    "=== Rapport Dofus Planner ===",
    `Date : ${new Date().toISOString()}`,
    `Version : ${process.env.NEXT_PUBLIC_BUILD_ID ?? "inconnue"}`,
    `Node : ${process.version}`,
    `Mode debug : ${(await isDebugEnabled()) ? "activé" : "désactivé"}`,
    `Clé Anthropic configurée : ${process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE ? "oui" : "non"}`,
    `DATA_DIR : ${DATA_DIR}`,
    "",
    "=== Journal (du plus ancien au plus récent) ===",
  ];
  const lines = recentLogs().map(formatEntry);
  return [...head, ...(lines.length ? lines : ["(vide : active le mode debug puis reproduis le problème)"])].join("\n");
}
