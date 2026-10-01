import { ELEMENTS } from "./types";

/** Couleur d'accent par classe, pour les avatars (pas d'illustration officielle embarquée). */
const CLASS_COLORS: Record<string, string> = {
  Crâ: "#5f9e4b",
  Ecaflip: "#d08a2c",
  Eliotrope: "#3fa7a3",
  Eniripsa: "#d65b95",
  Enutrof: "#b8953a",
  Féca: "#4a78c9",
  Forgelance: "#8a6bd1",
  Huppermage: "#6f5bd6",
  Iop: "#d24a3a",
  Osamodas: "#3e9a63",
  Ouginak: "#a0673a",
  Pandawa: "#5b8f8c",
  Roublard: "#c0503a",
  Sacrieur: "#b02f3f",
  Sadida: "#5a9a3a",
  Sram: "#5d5f8f",
  Steamer: "#3a8fb0",
  Xélor: "#4b5fb5",
  Zobal: "#a8579e",
};

export function classColor(className: string): string {
  return CLASS_COLORS[className] ?? "#8d96a6";
}

export function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function elementClass(element: (typeof ELEMENTS)[number]): string {
  return `el el-${element.toLowerCase()}`;
}
