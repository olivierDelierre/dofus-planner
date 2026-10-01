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

## Prochaine tâche : brancher l'import DofusBook

Lien d'exemple fourni par l'utilisateur : `https://www.dofusbook.net/mobile/fr/equipement/16088968-db/objets`

1. Vérifie l'accès réseau (`curl -sI https://www.dofusbook.net/`). S'il est bloqué, demande à l'utilisateur d'ouvrir les domaines listés dans `CLAUDE.md`.
2. Inspecte DofusBook. C'est une application web qui charge ses données par une API interne non documentée. Récupère la page, trouve dans son JS ou son HTML l'endpoint qui renvoie le stuff (personnage, classe, niveau, items, caractéristiques, sorts), et note s'il exige des en-têtes ou des cookies. Si ce n'est pas possible, demande à l'utilisateur de copier la réponse JSON depuis l'onglet Réseau de son navigateur (F12).
3. Implémente `fetchDofusbookProfile()` vers `DofusbookProfile` :
   - déduis les `elements` à partir des caractéristiques principales (Force → Terre, Intelligence → Feu, Chance → Eau, Agilité → Air) ;
   - garde les URL d'icônes des items et des sorts si elles existent, plus l'illustration de classe (`classImage`) ;
   - clés de stats mises en avant dans la fiche : `pa`, `pm`, `pv`, `po`, `vitalite` ;
   - mets en cache comme les autres sources, et respecte le site (pas de requêtes en rafale).
4. Ajoute un test avec une **vraie réponse enregistrée** (fixture dans `tests/fixtures/`), dans le même esprit que `tests/dpln.test.ts`.
5. Si les icônes viennent d'un CDN externe, vérifie qu'elles s'affichent. L'app ne définit pas de CSP pour l'instant.
6. Mets à jour le `README.md`, qui décrit encore la saisie manuelle : section « Fonctionnement », et la migration de `team.json` (les persos saisis à la main ne sont plus valides avec le nouveau schéma, à confirmer avec l'utilisateur : migration ou remise à zéro).
7. Fusionne `refonte-mobile-dofusbook` dans `main` une fois que tout est testé.

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
