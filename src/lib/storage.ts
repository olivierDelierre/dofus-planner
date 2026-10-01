import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { log } from "./debuglog";
import { CharacterSchema, TeamSchema, type Character, type GuideFile, type PlanRecord } from "./types";

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const TEAM_FILE = path.join(DATA_DIR, "team.json");
export const GUIDES_DIR = path.join(DATA_DIR, "guides");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
const PLANS_DIR = path.join(DATA_DIR, "plans");

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Écriture atomique : fichier temporaire puis renommage, jamais de JSON à moitié écrit. */
export async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await fs.rename(tmp, file);
}

// Sérialise les lecture-modification-écriture d'un même fichier (plusieurs profils en parallèle).
const locks = new Map<string, Promise<unknown>>();
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

/** Slug sûr pour un nom de fichier (pas de "..", pas de "/"). */
export function toSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// ---------- Équipe (partagée entre profils) ----------

export async function loadTeam(): Promise<Character[]> {
  const raw = await readJson<unknown>(TEAM_FILE);
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter((c) => CharacterSchema.safeParse(c).success);
  if (valid.length < raw.length) {
    // Anciens personnages (saisie manuelle ou import DofusBook) : conservés à part, jamais perdus.
    const backup = path.join(DATA_DIR, "team.legacy.json");
    if (!(await readJson<unknown>(backup))) await writeJson(backup, raw);
  }
  return TeamSchema.parse(valid);
}

export function addCharacter(input: Omit<Character, "id">): Promise<Character> {
  return withLock(TEAM_FILE, async () => {
    const character = CharacterSchema.parse({ ...input, id: randomUUID() });
    await writeJson(TEAM_FILE, [...(await loadTeam()), character]);
    return character;
  });
}

/** Applique une modification partielle ; `patch` reçoit la version courante (sous verrou). */
export function updateCharacter(
  id: string,
  patch: (current: Character) => Promise<Partial<Omit<Character, "id">>>,
): Promise<Character | null> {
  return withLock(TEAM_FILE, async () => {
    const team = await loadTeam();
    const index = team.findIndex((c) => c.id === id);
    if (index === -1) return null;
    team[index] = CharacterSchema.parse({ ...team[index], ...(await patch(team[index])), id });
    await writeJson(TEAM_FILE, team);
    return team[index];
  });
}

export function deleteCharacter(id: string): Promise<boolean> {
  return withLock(TEAM_FILE, async () => {
    const team = await loadTeam();
    const remaining = team.filter((c) => c.id !== id);
    if (remaining.length === team.length) return false;
    await writeJson(TEAM_FILE, remaining);
    return true;
  });
}

// ---------- Guides Dofus pour les noobs (partagés) ----------

export async function saveGuide(guide: GuideFile): Promise<void> {
  await writeJson(path.join(GUIDES_DIR, `${toSlug(guide.slug)}.json`), guide);
}

export async function loadGuide(slug: string): Promise<GuideFile | null> {
  return readJson<GuideFile>(path.join(GUIDES_DIR, `${toSlug(slug)}.json`));
}

export async function listGuides(): Promise<Omit<GuideFile, "content">[]> {
  let files: string[];
  try {
    files = await fs.readdir(GUIDES_DIR);
  } catch {
    return [];
  }
  const guides = await Promise.all(
    files.filter((f) => f.endsWith(".json")).map((f) => readJson<GuideFile>(path.join(GUIDES_DIR, f))),
  );
  return guides
    .filter((g): g is GuideFile => g !== null)
    .map(({ content: _content, ...meta }) => meta)
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));
}

// ---------- Historique des plans (par profil) ----------

function planDir(profileId: string): string {
  return path.join(PLANS_DIR, toSlug(profileId));
}

export async function savePlan(record: PlanRecord): Promise<void> {
  await writeJson(path.join(planDir(record.profileId), `${toSlug(record.id)}.json`), record);
}

export async function loadPlan(profileId: string, id: string): Promise<PlanRecord | null> {
  return readJson<PlanRecord>(path.join(planDir(profileId), `${toSlug(id)}.json`));
}

export async function deletePlan(profileId: string, id: string): Promise<boolean> {
  try {
    await fs.unlink(path.join(planDir(profileId), `${toSlug(id)}.json`));
    return true;
  } catch {
    return false;
  }
}

export interface PlanSummary {
  id: string;
  createdAt: string;
  encounter: string;
  participants: string[];
  stars: number;
}

export async function listPlans(profileId: string): Promise<PlanSummary[]> {
  let files: string[];
  try {
    files = await fs.readdir(planDir(profileId));
  } catch {
    return [];
  }
  const records = await Promise.all(
    files.filter((f) => f.endsWith(".json")).map((f) => readJson<PlanRecord>(path.join(planDir(profileId), f))),
  );
  return records
    .filter((r): r is PlanRecord => r !== null)
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      encounter: r.encounter.name,
      participants: r.participants.map((p) => p.profile.name),
      stars: r.result.plan.confidence.stars,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------- Cache des API de données ----------

/** Cache disque générique pour les réponses d'API (clé = URL). */
export async function cachedFetchJson(url: string, ttlMs = 7 * 24 * 3600 * 1000): Promise<unknown> {
  const key = toSlug(url.replace(/^https?:\/\//, "")).slice(0, 100);
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 12);
  const file = path.join(CACHE_DIR, `${key}-${hash}.json`);
  const cached = await readJson<{ at: number; data: unknown }>(file);
  if (cached && Date.now() - cached.at < ttlMs) {
    log("debug", "cache", `Cache : ${new URL(url).pathname}`);
    return cached.data;
  }

  const started = Date.now();
  const target = new URL(url);
  const short = `${target.host}${target.pathname}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    log("error", "api", `Appel impossible vers ${short}`, { url, error: err instanceof Error ? err.message : String(err) });
    throw new Error(`Appel impossible vers ${target.host} : ${err instanceof Error ? err.message : err}`);
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    log("error", "api", `HTTP ${res.status} sur ${short}`, { url, body });
    // Le détail (chemin et message du serveur) aide à comprendre un refus de requête.
    let detail = body;
    try {
      detail = JSON.parse(body).message ?? body;
    } catch {
      // corps non JSON : on garde le texte brut
    }
    throw new Error(`HTTP ${res.status} sur ${short}${detail ? ` : ${detail}` : ""}`);
  }
  const data = await res.json();
  log("debug", "api", `GET ${short} → ${res.status} (${Date.now() - started} ms)`, { url });
  await writeJson(file, { at: Date.now(), data });
  return data;
}
