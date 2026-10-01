import { z } from "zod";

export const CLASSES = [
  "Crâ",
  "Ecaflip",
  "Eliotrope",
  "Eniripsa",
  "Enutrof",
  "Féca",
  "Forgelance",
  "Huppermage",
  "Iop",
  "Osamodas",
  "Ouginak",
  "Pandawa",
  "Roublard",
  "Sacrieur",
  "Sadida",
  "Sram",
  "Steamer",
  "Xélor",
  "Zobal",
] as const;

export const ELEMENTS = ["Terre", "Feu", "Eau", "Air", "Neutre"] as const;

export const MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", hint: "meilleure analyse" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "moins cher" },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];

/** Emplacements d'équipement d'un personnage. */
export const SLOTS = [
  "Chapeau", "Cape", "Amulette", "Anneau 1", "Anneau 2", "Ceinture", "Bottes", "Arme", "Bouclier", "Familier",
  "Dofus 1", "Dofus 2", "Dofus 3", "Dofus 4", "Dofus 5", "Dofus 6",
] as const;
export type Slot = (typeof SLOTS)[number];

export const GENDERS = ["m", "f"] as const;

export const BASE_STATS = ["vitalite", "sagesse", "force", "intelligence", "chance", "agilite"] as const;
export type BaseStat = (typeof BASE_STATS)[number];

/** Ce que l'utilisateur saisit dans l'éditeur : seulement des identifiants et des nombres. */
export const BuildInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  classId: z.number().int(),
  gender: z.enum(GENDERS),
  level: z.number().int().min(1).max(200),
  /** Points investis dans chaque caractéristique (capital + parchemins), hors équipement. */
  base: z.object(Object.fromEntries(BASE_STATS.map((k) => [k, z.number().int().min(0).max(2000)])) as Record<BaseStat, z.ZodNumber>),
  items: z.array(z.object({ slot: z.enum(SLOTS), itemId: z.number().int() })).max(SLOTS.length),
  spells: z.array(z.object({ id: z.number().int(), level: z.number().int().min(1).max(6) })).max(60),
});
export type BuildInput = z.infer<typeof BuildInputSchema>;

/** Fiche complète : saisie + données du jeu (noms, icônes, effets) + caractéristiques calculées. */
export const ProfileSchema = z.object({
  name: z.string(),
  classId: z.number().int(),
  className: z.string(),
  gender: z.enum(GENDERS),
  level: z.number().int(),
  /** Symbole de classe et tête du personnage (chemins locaux ou URL DofusDB). */
  classImage: z.string().optional(),
  headImage: z.string().optional(),
  base: BuildInputSchema.shape.base,
  elements: z.array(z.enum(ELEMENTS)),
  items: z.array(
    z.object({
      slot: z.string(),
      itemId: z.number().int(),
      name: z.string(),
      level: z.number().int().optional(),
      type: z.string().optional(),
      icon: z.string().optional(),
      effects: z.array(z.string()).default([]),
    }),
  ),
  stats: z.array(z.object({ key: z.string(), label: z.string(), value: z.union([z.number(), z.string()]) })),
  spells: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      level: z.number().int().optional(),
      icon: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
});
export type CharacterProfile = z.infer<typeof ProfileSchema>;

export const CharacterSchema = z.object({
  id: z.string(),
  profile: ProfileSchema,
  /** Saisie d'origine, pour rouvrir l'éditeur. */
  build: BuildInputSchema,
  /** Notes libres pour Claude (rôle habituel, habitudes de jeu…). */
  notes: z.string().optional(),
  /** Nom du profil qui a créé le personnage (l'équipe est partagée entre profils). */
  owner: z.string().optional(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const TeamSchema = z.array(CharacterSchema);
export const SaveCharacterSchema = z.object({ build: BuildInputSchema, notes: z.string().max(2000).optional() });
export const UpdateNotesSchema = z.object({ notes: z.string().max(2000) });

export const EncounterSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["donjon", "quete", "autre"]),
  /** Niveau du donjon/combat si connu (sinon Claude le cherche). */
  level: z.number().int().min(1).max(200).optional(),
  /** URL Dofus pour les noobs si déjà connue. */
  guideUrl: z.string().url().optional(),
  notes: z.string().optional(),
});
export type Encounter = z.infer<typeof EncounterSchema>;

export const PlanRequestSchema = z.object({
  encounter: EncounterSchema,
  participantIds: z.array(z.string()).min(1),
  model: z.enum([MODELS[0].id, MODELS[1].id]).default("claude-opus-5-5"),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

/**
 * Schéma de sortie structurée demandé à Claude.
 * Pas de contraintes min/max ici : les sorties structurées ne les supportent pas toutes,
 * on borne les valeurs après coup.
 */
export const PlanSchema = z.object({
  encounterSummary: z.object({
    name: z.string(),
    level: z.string().describe("Niveau ou fourchette de niveau, ou 'inconnu'"),
    keyMechanics: z.array(z.string()),
    monsters: z.array(
      z.object({
        name: z.string(),
        role: z.string().describe("Boss, soutien, invocateur..."),
        weaknesses: z.string().describe("Résistances faibles / éléments conseillés, si connus"),
        threats: z.string(),
      }),
    ),
  }),
  characters: z.array(
    z.object({
      name: z.string(),
      role: z.string().describe("Rôle dans ce combat : tank, soin, dégâts, placement..."),
      changes: z.array(
        z.object({
          category: z.enum(["sort", "stuff", "caracteristiques", "element", "consommable", "autre"]),
          change: z.string(),
          why: z.string(),
        }),
      ),
      keySpells: z.array(z.string()),
    }),
  ),
  strategy: z.object({
    overview: z.string(),
    preparation: z.array(z.string()),
    placement: z.string(),
    phases: z.array(z.object({ title: z.string(), steps: z.array(z.string()) })),
    dangers: z.array(z.string()),
  }),
  confidence: z.object({
    stars: z.number().int().describe("Note finale de 1 à 5"),
    reasoning: z.string(),
  }),
  missingInfo: z.array(z.string()).describe("Infos manquantes ou incertaines qui limitent le plan"),
  sources: z.array(z.string()).describe("URLs ou guides locaux utilisés"),
});
export type Plan = z.infer<typeof PlanSchema>;

export interface BaselineScore {
  stars: number;
  factors: string[];
}

export interface PlanResponse {
  plan: Plan;
  baseline: BaselineScore;
  research: string;
  model: string;
  servedBy: string;
}

export interface GuideFile {
  slug: string;
  url: string;
  title: string;
  fetchedAt: string;
  content: string;
}

export interface PlanRecord {
  id: string;
  profileId: string;
  createdAt: string;
  encounter: Encounter;
  /** Copie des personnages au moment du plan (ils peuvent changer ensuite). */
  participants: Character[];
  result: PlanResponse;
}

/** Événements envoyés en flux NDJSON par POST /api/plan. */
export type PlanStreamEvent =
  | { type: "progress"; message: string; at: number }
  | { type: "done"; record: PlanRecord }
  | { type: "error"; error: string };
