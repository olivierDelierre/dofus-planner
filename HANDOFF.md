# Passation : état du projet

_Dernière mise à jour : 1er octobre 2026, fin de la session 1._

Mets à jour ce fichier à la fin de chaque session : état, branches et prochaines étapes.

## Où on en est

### `main` : stable, fonctionnelle

- Profils (mot de passe), équipe partagée **saisie à la main** (classe, niveau, éléments, stuff, sorts), historique des plans par profil.
- Génération en deux phases avec Claude et étapes affichées en direct (flux NDJSON).
- Scraper Dofus pour les noobs, accès DofusDude et DofusDB avec cache.
- Image Docker et `compose.yaml`.
- 6 tests unitaires. Parcours complet validé avec le faux serveur Anthropic et Playwright.

### `refonte-mobile-dofusbook` : en cours, **à ne pas fusionner tant que l'import DofusBook ne fonctionne pas**

- Refonte mobile-first : barre d'onglets en bas sur mobile, en haut sur ordinateur, thème sombre par défaut avec bascule clair/sombre dans le menu Compte.
- Le modèle de personnage devient « lien DofusBook + fiche importée » (`DofusbookProfileSchema` dans `src/lib/types.ts`). La saisie manuelle a disparu, à la demande de l'utilisateur.
- Composants : `TeamTab`, `CharacterSheet` (fiche en lecture seule), `Avatar`, `CombatTab`, `PlansTab`, `AccountSheet`.
- `src/lib/dofusbook.ts` : l'analyse des liens est faite et testée. **`fetchDofusbookProfile()` est un stub qui lève une erreur**, donc on ne peut pas encore ajouter de perso sur cette branche.
- UI vérifiée avec des données fictives : captures mobile et ordinateur OK. 8 tests unitaires.

## Session 2 (1er octobre 2026)

- (Abandonné) **DofusBook est bloqué par Cloudflare depuis le conteneur cloud** : `dofusbook.net`, `www.dofusbook.net` et `www.d-bk.net` répondent 403 « Attention Required » (même avec un User-Agent de navigateur ou Chromium via Playwright). Seul `d-bk.net/fr/d/<id>` répond (301 vers dofusbook.net). L'import ne peut donc pas être inspecté ici : il faut une réponse JSON enregistrée par l'utilisateur (F12 → Réseau), ou tester l'app depuis le réseau de l'utilisateur.
- DofusDB, DofusDude, dofuspourlesnoobs.com et static.ankama.com sont joignables.
- **Assets officiels** : `scripts/fetch-assets.mjs` télécharge dans `public/game/` (versionné) les symboles des 19 classes (`api.dofusdb.fr/img/breeds/symbol_N.png`) et les icônes de caractéristiques (`dofusdb.fr/icons/characteristics/tx_*.png`). `src/lib/assets.ts` les expose (`classIcon`, `elementIcon`, `statIcon`) ; utilisés dans `Avatar`, `CharacterSheet`, `TeamTab`.
- Icônes d'items et de sorts : `https://api.dofusdb.fr/img/items/<iconId>.png` et `.../img/spells/sort_<iconId>.png` (le champ `img` des réponses DofusDB). Pas d'icône pour les PV (`tx_lifePoints` n'existe pas).

## Création de personnages dans l'app (décision du 1er octobre, DofusBook abandonné)

Fait sur `refonte-mobile-dofusbook` : `src/lib/builder.ts` (saisie → fiche, calcul des caractéristiques), routes `/api/game/{items,spells,breeds,preview}`, `/api/icon` (proxy d'images avec cache), `CharacterEditor` (classe, genre, niveau, points de base, équipement par emplacement, sorts avec niveaux, aperçu des stats), `Paperdoll` (équipement façon DofusBook), `CharacterSheet`. Interface mobile et PC (deux colonnes ≥ 1000 px). Anciens personnages mis de côté dans `data/team.legacy.json`.

Panoplies (session 3) : `getSet()` dans `gamedata.ts` lit DofusDude `/sets/<id>` (bonus cumulés par nombre de pièces), mis en cache 60 jours sur disque ; `buildProfile` compte les pièces par panoplie, ajoute le bonus actif aux caractéristiques et remplit `profile.sets` (affiché par `SetsList`, transmis à Claude). Les fiches enregistrées avant cette version n'ont pas de panoplies : bouton « Actualiser » pour les recalculer.

Limites connues / idées :
- PA, PM et PV de base sont des estimations (PA 6, 7 dès le niveau 100 ; PM 3 ; PV 55 + 5/niveau) : à vérifier avec le jeu. Les bonus d'objets sont pris au jet maximum.
- Pas de rendu en pied du personnage (le renderer d'Ankama ne gère pas les looks Dofus 3) : on affiche le symbole de classe et la tête.
- Pas de contrôle que l'objet correspond bien à l'emplacement côté serveur (l'éditeur ne propose que les bons types) ; familiers sans stats (absents de DofusDude).
- Fusionner `refonte-mobile-dofusbook` dans `main` après validation par l'utilisateur.

## Session 4 : base de donjons et champ libre

- Extracteur dpln corrigé (il renvoyait ~300 caractères sur les vraies pages) ; 151 donjons scrapés dans `data/guides/` (2,6 Mo, versionnés ; seul « Caverne des Bulbes » est un stub côté site). Plafond de contenu à 90 000 caractères.
- Outil Claude `find_local_guides` ; `Encounter.lookup` (champ libre) active le `web_search` ouvert (6 usages) et la consigne « non vérifié ». Panneau Guides : synchronisation NDJSON, filtre.
- Testé avec le faux serveur Anthropic (find → read → plan) ; un vrai appel à Claude n'a toujours pas été fait.
- Travail directement sur `main` à la demande de l'utilisateur (plus de branche de fonctionnalité).

## Session 5 : sorts (niveaux, variantes) et accès de Claude aux sorts

- Le niveau d'un sort n'est plus saisi : `spellGrade()` (`src/lib/spells.ts`) = nombre de grades dont `minPlayerLevel` ≤ niveau du perso (DofusDB `spell-levels`, 3 grades max). Un sort pas encore appris a `level: 0` et reste affiché grisé.
- Variantes : `getClassSpells()` (`gamedata.ts`) lit `/spell-variants?breedId=` (une variante par sort de classe), cache 60 jours. `build.spells = [{ id: sortDeBase, variant: true }]` ne contient que les variantes choisies ; une variante pas encore débloquée retombe sur le sort de base. Les anciennes saisies `{id, level}` restent valides.
- Claude recevait seulement `Nom (niv. N)` et n'avait aucun outil pour les sorts : `describeTeam` envoie maintenant description, PA, portée, relance et l'alternative de chaque sort, et l'outil `get_class_spells` décrit toute la classe (base + variante + grades).
- Les fiches enregistrées avant cette version gardent leurs anciens sorts jusqu'à « ↻ Actualiser ».
- Piste non faite : dommages chiffrés par grade (`spell-levels.effects`, `diceNum`/`diceSide`).

## Encore jamais testé en conditions réelles

À vérifier dès que le réseau le permet. Ces points sont aussi signalés dans le README.

- **Un vrai appel à Claude** : il n'y a jamais eu de clé API. À vérifier :
  - le tool runner avec `fallbacks: "default"` ;
  - `betaZodOutputFormat(PlanSchema)` avec zod 4 ;
  - le web_search limité à `dofuspourlesnoobs.com` ;
  - le coût réel d'une génération.
- **DofusDB** : la syntaxe `name.fr[$search]` est une supposition. La vraie API est de type Feathers. Corrige `src/lib/gamedata.ts` si besoin.
- **DofusDude** : endpoints `/dofus3/v1/fr/items/equipment/search` et `/sets/search`.
- **Scraper Dofus pour les noobs** : à tester sur de vraies pages. L'extraction est générique et cible `#wsite-content`, avec un repli sur `main`, `article` puis `body`.
- **Build Docker complet** (`npm ci` dans l'image) : impossible ici à cause du proxy. Seule l'étape d'exécution a été validée.

## Idées pour plus tard (non demandées, à proposer seulement)

- Sorts de classe depuis une API (DofusDB) plutôt que depuis les connaissances de Claude.
- Afficher les notes de progression de Claude (`thinking.display: "updates"`) dans l'avancement.
- Partager un plan avec l'autre profil.
- Sauvegarde automatique du volume `/data`.
