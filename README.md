# Dofus Planner

Planificateur de donjons et de combats spéciaux pour **Dofus 3**, assisté par Claude.

1. Tu crées les personnages de l'équipe dans l'app : classe, genre, niveau, points de caractéristiques, un objet par emplacement (recherche avec icônes) et les sorts de la classe avec leur niveau. Les caractéristiques totales sont calculées automatiquement.
2. Tu choisis un donjon ou un combat de quête (ex. *Bandits de Cania*) et les persos qui y participent.
3. Claude cherche les infos du combat, puis propose pour chaque perso ce qu'il faut changer et pourquoi. Il donne aussi la marche à suivre et une note de confiance de 1 à 5 étoiles.

## Fonctionnement

```
Guides locaux (data/guides) ──┐
Dofus pour les noobs ─────────┼─► Phase 1 : recherche (Claude + outils) ─► notes
DofusDB / DofusDude (+cache) ─┘                                              │
                         Équipe + score de base déterministe ────────────────┤
                                                                              ▼
                                       Phase 2 : plan structuré (JSON) ─► affichage + historique
```

- **Scraper Dofus pour les noobs** (`src/lib/dpln.ts`) : il extrait le texte d'une page de guide (titres, paragraphes, listes, tableaux) et l'enregistre dans `data/guides/<slug>.json`. Pendant la génération, Claude trouve la page avec une recherche web limitée à `dofuspourlesnoobs.com`, puis la scrape. Les fois suivantes, il relit directement la copie locale.
- **Personnages** (`src/lib/builder.ts`) : la saisie ne contient que des identifiants et des nombres ; le serveur la complète avec les noms, icônes et effets des objets (DofusDB + DofusDude) et les sorts de la classe, puis calcule PA, PM, PV, portée, caractéristiques et éléments, bonus de panoplie compris (une panoplie est récupérée une fois sur DofusDude puis relue depuis le cache disque). Les icônes distantes passent par `/api/icon` (liste blanche, cache disque) ; celles des classes et des caractéristiques sont dans `public/game/` (`node scripts/fetch-assets.mjs` pour les mettre à jour). DofusBook est bloqué par Cloudflare, il n'est donc pas utilisé. Les personnages d'une ancienne version sont mis de côté dans `data/team.legacy.json`.
- **Interface** : pensée pour le mobile (barre d'onglets en bas) et adaptée au grand écran (fiche et éditeur en deux colonnes).
- **API de données** (`src/lib/gamedata.ts`) : DofusDude pour les équipements et panoplies, DofusDB pour les monstres et donjons. Les réponses sont mises en cache 7 jours dans `data/cache/`.
- **Score de base** (`src/lib/score.ts`) : il tient compte de l'écart de niveau, du nombre de persos, de la présence de soin et de protection, et de la couverture élémentaire. Claude part de ce score et doit justifier tout écart.
- **Modèle** : choix dans l'UI entre Opus 5.5 (par défaut) et Sonnet 5.5. Un repli automatique côté serveur est activé si un classifieur refuse une requête par erreur.

## Profils

- Au premier lancement, l'app demande de créer un profil.
- Une fois connecté, *Ajouter un profil* permet d'en créer d'autres, par exemple pour un ou une partenaire.
- L'**équipe est partagée** : tout le monde voit et modifie les mêmes persos, et chacun affiche qui l'a ajouté.
- L'**historique des plans est privé** à chaque profil.
- Les mots de passe sont hachés avec scrypt. La session est un cookie signé valable 30 jours.
- Après 5 essais ratés, un profil est bloqué pendant une minute.

> Pensé pour un **réseau local ou un VPN** (Tailscale, WireGuard). Ne l'expose pas directement sur Internet : il n'y a ni HTTPS intégré, ni récupération de mot de passe.

## Installation

Prérequis : Node.js 20 ou plus.

```bash
npm install
cp .env.example .env.local   # puis renseigner ANTHROPIC_API_KEY
npm run build
npm start -- -H 0.0.0.0 -p 3000
```

L'app est ensuite accessible depuis les autres appareils du réseau sur `http://<ip-de-la-machine>:3000`.

En développement : `npm run dev`.

### Avec Docker (recommandé pour l'héberger chez soi)

```bash
cp .env.example .env.local   # puis renseigner ANTHROPIC_API_KEY
docker compose up -d --build
```

- L'app écoute sur le port 3000. Pour le changer, modifie `ports` dans `compose.yaml`.
- Les données sont dans le volume `dofus-data`, monté sur `/data`. Pour une sauvegarde : `docker run --rm -v dofus-data:/data -v "$PWD":/backup alpine tar czf /backup/dofus-data.tgz -C /data .`
- Le conteneur tourne avec l'utilisateur `node` (uid 1000). Si tu remplaces le volume par un dossier de l'hôte, donne-le à cet uid : `chown -R 1000:1000 <dossier>`.
- Mise à jour : `git pull && docker compose up -d --build`.

### Pré-remplir des guides

```bash
npm run scrape -- https://www.dofuspourlesnoobs.com/<page>.html [autres URLs…] [--refresh]
```

Tu peux aussi le faire depuis l'UI, dans la section *Guides locaux*.

## Données

Tout est stocké dans `data/` (modifiable avec `DATA_DIR`) :

| Fichier / dossier       | Contenu                                | Versionné |
| ----------------------- | -------------------------------------- | --------- |
| `profiles.json`         | profils et hachés de mots de passe     | non       |
| `session-secret.key`    | secret de signature des sessions       | non       |
| `team.json`             | équipe partagée                        | non       |
| `plans/<profil>/`       | historique des plans                   | non       |
| `guides/`               | guides Dofus pour les noobs scrapés    | oui       |
| `cache/`                | cache des API DofusDude / DofusDB      | non       |

Pour une sauvegarde, il suffit de copier le dossier `data/`.

## Scripts

| Commande            | Rôle                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | serveur de développement      |
| `npm run build`     | build de production           |
| `npm start`         | serveur de production         |
| `npm test`          | tests unitaires               |
| `npm run typecheck` | vérification TypeScript       |
| `npm run scrape`    | scraping de guides en CLI     |

## Limites connues

- Les requêtes vers DofusDB (`name.fr[$search]`) et DofusDude n'ont pas encore été vérifiées contre les vraies API. En cas d'erreur, Claude reçoit le message et le signale dans les *infos manquantes*.
- L'extraction de Dofus pour les noobs est générique. Si une page sort vide ou mal structurée, il faudra ajuster `extractGuide`, en partant du test `tests/dpln.test.ts`.
- Les sorts de classe ne viennent pas d'une API : Claude s'appuie sur ce que tu saisis et sur ses connaissances générales, qui peuvent être en retard sur un patch.
- Une génération coûte quelques dizaines de centimes avec Opus, moins avec Sonnet. Elle prend en général 1 à 3 minutes, et ses étapes s'affichent en direct. Si tu fermes la page, la génération continue et le plan arrive dans « Mes plans ».
- Derrière un reverse proxy, garde le flux de `/api/plan` sans mise en tampon. L'en-tête `X-Accel-Buffering: no` est déjà envoyé pour nginx.
- Le script `npm run scrape` n'est pas inclus dans l'image Docker. Dans ce cas, passe par l'UI.
