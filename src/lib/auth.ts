/**
 * Profils et sessions.
 *
 * - Mots de passe hachés avec scrypt (sel aléatoire), comparaison en temps constant.
 * - Session = cookie HttpOnly signé en HMAC (profil + expiration), sans stockage serveur.
 * - Le secret de signature vient de SESSION_SECRET, sinon il est généré une fois dans data/.
 *
 * Pensé pour un usage sur réseau local / VPN : pas de 2FA ni de récupération de mot de passe.
 */
import { createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { cookies } from "next/headers";
import { DATA_DIR, readJson, withLock, writeJson } from "./storage";

const scrypt = promisify(scryptCb) as (pwd: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");
const SECRET_FILE = path.join(DATA_DIR, "session-secret.key");
export const SESSION_COOKIE = "dp_session";
const SESSION_DAYS = 30;

interface StoredProfile {
  id: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}
export type Profile = Omit<StoredProfile, "passwordHash">;

async function readProfiles(): Promise<StoredProfile[]> {
  return (await readJson<StoredProfile[]>(PROFILES_FILE)) ?? [];
}

const publicProfile = ({ passwordHash: _hash, ...p }: StoredProfile): Profile => p;

export async function listProfiles(): Promise<Profile[]> {
  return (await readProfiles()).map(publicProfile);
}

export async function hasProfiles(): Promise<boolean> {
  return (await readProfiles()).length > 0;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function createProfile(name: string, password: string): Promise<Profile> {
  return withLock(PROFILES_FILE, async () => {
    const profiles = await readProfiles();
    if (profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ce nom de profil existe déjà");
    }
    const profile: StoredProfile = {
      id: randomUUID(),
      name,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    await writeJson(PROFILES_FILE, [...profiles, profile]);
    return publicProfile(profile);
  });
}

export async function changePassword(profileId: string, current: string, next: string): Promise<void> {
  await withLock(PROFILES_FILE, async () => {
    const profiles = await readProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile || !(await verifyPassword(current, profile.passwordHash))) {
      throw new Error("Mot de passe actuel incorrect");
    }
    profile.passwordHash = await hashPassword(next);
    await writeJson(PROFILES_FILE, profiles);
  });
}

// Ralentit les essais de mot de passe à la chaîne (mémoire du processus, suffisant en local).
const failures = new Map<string, { count: number; until: number }>();

export async function checkCredentials(name: string, password: string): Promise<Profile> {
  const key = name.toLowerCase();
  const lock = failures.get(key);
  if (lock && lock.until > Date.now()) {
    throw new Error("Trop d'essais, réessaie dans une minute");
  }

  const profile = (await readProfiles()).find((p) => p.name.toLowerCase() === key);
  if (profile && (await verifyPassword(password, profile.passwordHash))) {
    failures.delete(key);
    return publicProfile(profile);
  }

  const count = (lock?.count ?? 0) + 1;
  failures.set(key, { count, until: count >= 5 ? Date.now() + 60_000 : 0 });
  throw new Error("Profil ou mot de passe incorrect");
}

let secretPromise: Promise<Buffer> | null = null;
function getSecret(): Promise<Buffer> {
  secretPromise ??= (async () => {
    if (process.env.SESSION_SECRET) return Buffer.from(process.env.SESSION_SECRET);
    try {
      return Buffer.from(await fs.readFile(SECRET_FILE, "utf8"), "hex");
    } catch {
      const secret = randomBytes(32);
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(SECRET_FILE, secret.toString("hex"), { mode: 0o600 });
      return secret;
    }
  })();
  return secretPromise;
}

async function sign(payload: string): Promise<string> {
  return createHmac("sha256", await getSecret()).update(payload).digest("base64url");
}

export async function startSession(profileId: string): Promise<void> {
  const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const payload = `${profileId}.${expires}`;
  (await cookies()).set(SESSION_COOKIE, `${payload}.${await sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    // En HTTP sur le réseau local, un cookie "secure" ne serait jamais renvoyé.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Profil de la requête courante, ou null si non connecté / session invalide. */
export async function currentProfile(): Promise<Profile | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [profileId, expires, signature] = raw.split(".");
  if (!profileId || !expires || !signature || Number(expires) < Date.now()) return null;

  const expected = Buffer.from(await sign(`${profileId}.${expires}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const profile = (await readProfiles()).find((p) => p.id === profileId);
  return profile ? publicProfile(profile) : null;
}

export class UnauthorizedError extends Error {}

export async function requireProfile(): Promise<Profile> {
  const profile = await currentProfile();
  if (!profile) throw new UnauthorizedError("Non connecté");
  return profile;
}
