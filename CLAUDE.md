# Dofus Planner : guide pour les agents

**Lis d'abord `HANDOFF.md`** : il contient l'état actuel, la branche en cours et les prochaines tâches. Ce fichier-ci ne contient que ce qui reste vrai d'une session à l'autre.

## Le projet

App web auto-hébergée (chez l'utilisateur, sur son réseau local ou en VPN) qui prépare les donjons et les combats spéciaux de **Dofus 3**. On choisit un combat et des personnages, puis Claude :

1. rassemble les infos : guides Dofus pour les noobs scrapés et gardés en local, DofusDB, DofusDude ;
2. propose ce que chaque perso doit changer et pourquoi, la marche à suivre et une note de 1 à 5 étoiles.

Utilisateurs : le propriétaire du dépôt et sa femme, avec un profil chacun.

## Préférences de l'utilisateur (à respecter)

- **Réponds en français.** L'interface, les messages d'erreur et les commentaires du code sont en français.
- **Au moindre doute, pose une question** (AskUserQuestion) plutôt que de supposer. L'utilisateur l'a demandé explicitement.
- Décisions déjà prises, à ne pas reposer :
  - jeu : Dofus 3 (Unity), pas Retro ni Touch ;
  - stack : Next.js (App Router) + TypeScript ;
  - profils avec mot de passe, usage sur réseau local ou VPN uniquement, pas d'exposition Internet ;
  - **équipe partagée** entre profils, **historique des plans privé** par profil ;
  - modèle Claude au choix dans l'UI : Opus 5.5 par défaut, Sonnet 5.5 en option ;
  - données : DofusDude pour le stuff, DofusDB pour les monstres et donjons, scraper Dofus pour les noobs ;
  - personnages : **créés dans l'app** (DofusBook est bloqué par Cloudflare) : classe, genre, niveau, points de base, un objet par emplacement, sorts avec niveaux ; caractéristiques calculées côté serveur ; données et icônes de DofusDB et DofusDude ;
  - fiche perso : équipements en grille, caractéristiques, illustration de classe, sorts ;
  - design mobile-first **et adapté au grand écran PC** (fiche et éditeur en deux colonnes), **thème sombre par défaut**.
- Hébergement visé : Docker (`compose.yaml`).

## Commandes

```bash
npm install
npm run dev          # développement
npm run build        # build de production (fait aussi le typecheck)
npm run typecheck
npm test             # tests unitaires (node:test via tsx, dossier tests/)
npm run scrape -- <url dofuspourlesnoobs> [--refresh]
```

Avant chaque commit : `npx tsc --noEmit && npm test && npx next build`.

## Architecture

| Chemin | Rôle |
| --- | --- |
| `src/lib/types.ts` | Schémas zod : personnage, combat, plan (sortie structurée de Claude), événements de flux |
| `src/lib/planner.ts` | Génération en 2 phases : recherche (tool runner + web_search) puis plan structuré (`messages.parse`) |
| `src/lib/score.ts` | Score de confiance de base, déterministe. Claude doit justifier tout écart |
| `src/lib/dpln.ts` | Scraper Dofus pour les noobs : extraction générique HTML vers Markdown, liste blanche de domaines |
| `src/lib/gamedata.ts` | DofusDude et DofusDB, avec JSON allégé pour Claude |
| `src/lib/builder.ts` | Saisie du personnage vers fiche : résolution des objets, calcul des caractéristiques |
| `src/lib/assets.ts` | Icônes locales (`public/game/`, via `scripts/fetch-assets.mjs`) et proxy d'images `/api/icon` |
| `src/lib/storage.ts` | Fichiers JSON dans `DATA_DIR` : écriture atomique, `withLock` par fichier, cache des API |
| `src/lib/auth.ts` | Profils (scrypt), cookie de session signé HMAC, anti-bruteforce en mémoire |
| `src/lib/api.ts` | `authed()` enveloppe les routes qui exigent une session |
| `src/app/api/**` | Routes. `/api/plan` répond en flux **NDJSON** (progress, puis done ou error) |
| `scripts/dev/mock-anthropic.mjs` | Faux serveur Anthropic pour tester la génération sans clé ni coût |

Données (`DATA_DIR`, par défaut `./data`, `/data` en Docker) : `profiles.json`, `session-secret.key`, `team.json`, `plans/<profileId>/`, `guides/` (le seul dossier versionné), `cache/`.

## Pièges connus

- **TypeScript est figé en 5.9.** TypeScript 7 casse le chargement de `next.config.ts` avec Next 15 (`Cannot read properties of undefined (reading 'fileExists')`).
- **API Claude** : avant de toucher `planner.ts`, charge le skill `claude-api`.
  - Sur Opus 5.5 / Sonnet 5.5, `tool_choice` forcé renvoie une erreur 400. Opus 5.5 ne permet pas non plus de désactiver le thinking, et son effort par défaut est `medium`.
  - Le repli serveur passe par `fallbacks: "default"` avec la beta `server-side-fallback-2026-07-01`.
  - Le tool runner ne relance pas tout seul un `pause_turn` (web_search) : c'est géré dans la boucle.
- **`withLock` ne protège qu'au sein d'un seul processus.** Il ne faut pas lancer plusieurs instances sur le même `DATA_DIR`.
- `next build` en mode `standalone` copie `data/` dans `.next/standalone`. Le `.dockerignore` exclut les fichiers sensibles.
- Le cookie de session n'est `Secure` que si `COOKIE_SECURE=true`, car l'app est servie en HTTP sur le réseau local.
- Toute URL externe saisie par un utilisateur doit passer par une **liste blanche de domaines** (voir `assertDplnUrl` et la liste blanche de `/api/icon`), pour éviter que le serveur aille chercher des adresses arbitraires.

## Environnement cloud (sessions Claude Code sur le web)

- Le réseau sortant est filtré. Domaines dont le projet a besoin : `api.dofusdb.fr`, `api.dofusdu.de`, `www.dofuspourlesnoobs.com`. S'ils sont bloqués (`curl` renvoie `000` ou 403), demande à l'utilisateur de les ajouter : menu de l'environnement → Edit → Network access.
- `api.anthropic.com` est joignable, mais il n'y a pas de clé API. Pour tester la génération, lance `node scripts/dev/mock-anthropic.mjs` puis `ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://localhost:4010 PORT=3125 npx next start`.
- Docker : le daemon n'est pas lancé, il faut démarrer `dockerd` en arrière-plan. Dans le conteneur, `docker build` échoue sur `npm ci` à cause du proxy. Pour tester l'étape d'exécution, construis plutôt l'image depuis un `.next/standalone` local.
- Playwright et Chromium sont installés globalement : `require(execSync('npm root -g') + '/playwright')`. Ils servent aux captures d'écran mobile (390×844) et ordinateur.
- **N'utilise pas `pkill -f "next start"`** : le motif correspond aussi à ton propre shell, que ça tue. Garde le PID dans un fichier et fais `kill $(cat pid)`.

## Git

- `main` doit toujours rester fonctionnelle. Les gros changements passent par une branche, fusionnée une fois testée.
- Auteur des commits : `Olivier Delierre <o.delierre@etik.com>`. Messages en français.
