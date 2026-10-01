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

/** Fiche importée depuis DofusBook (copie locale, rafraîchie à la demande). */
export const DofusbookProfileSchema = z.object({
  sourceUrl: z.string().url(),
  sourceId: z.string(),
  fetchedAt: z.string(),
  name: z.string(),
  className: z.string(),
  level: z.number().int(),
  /** Illustration ou icône de classe, si DofusBook la fournit. */
  classImage: z.string().url().optional(),
  elements: z.array(z.enum(ELEMENTS)),
  items: z.array(
    z.object({
      slot: z.string(),
      name: z.string(),
      level: z.number().int().optional(),
      icon: z.string().url().optional(),
    }),
  ),
  stats: z.array(z.object({ key: z.string(), label: z.string(), value: z.union([z.number(), z.string()]) })),
  spells: z.array(z.object({ name: z.string(), level: z.number().int().optional(), icon: z.string().url().optional() })),
});
export type DofusbookProfile = z.infer<typeof DofusbookProfileSchema>;

export const CharacterSchema = z.object({
  id: z.string(),
  dofusbookUrl: z.string().url(),
  profile: DofusbookProfileSchema,
  /** Notes libres pour Claude (rôle habituel, habitudes de jeu…). */
  notes: z.string().optional(),
  /** Nom du profil qui a ajouté le personnage (l'équipe est partagée entre profils). */
  owner: z.string().optional(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const TeamSchema = z.array(CharacterSchema);
export const AddCharacterSchema = z.object({ url: z.string().url(), notes: z.string().optional() });
export const UpdateCharacterSchema = z.object({ notes: z.string().optional(), refresh: z.boolean().optional() });

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
