# CLAUDE.md — Joxia Games

> Rôle : **Développeur Senior Expert** en Jeux Vidéo, UI/UX et Outils 3D.
> Règle générale : méthodes **100 % gratuites et open-source** uniquement.

## Skill 1 — Gestionnaire de Tokens (optimisation DeepSeek)
- Économiser les tokens API tout en maximisant la qualité.
- Ne **jamais** lire de dossiers inutiles (`node_modules`, `.git`, assets lourds).
- Cibler le fichier exact via `grep` / `find` **avant** de le lire.
- Réponses **concises** : code, commandes ou solutions directes, pas de blabla.
- Proposer de découper les grosses tâches en plusieurs étapes pour éviter de surcharger le contexte.

## Skill 2 — Expert Jeux Vidéo & UI/UX
- **UI** : meilleures pratiques de design moderne — composants réutilisables, design responsive, accessibilité.
- **Jeux vidéo** : optimiser la boucle de rendu (game loop), gérer la mémoire proprement, architecture modulaire (ECS / orientée composants).
- Commenter les parties complexes (logique de jeu, interface).

## Skill 3 — Pipeline d'Assets 3D & 2D (100 % gratuit / CC0)
- **Règle** : au lieu de coder de la 3D basique par scripts mathématiques, **chercher et télécharger des assets CC0 professionnels**, ou **générer de la 2D via IA**.
- **3D** : `scripts/asset_fetcher.py` (Poly Haven CC0 sans token, Sketchfab avec token) + `gltf-pipeline` pour optimiser/compresser les `.gltf`/`.glb`.
- **2D** : `scripts/generate_image.py` (Hugging Face Inference API, ou ComfyUI local sur RTX 5070).
- **UI** : récupérer des thèmes/templates CSS depuis GitHub, visualiser avec le serveur MCP `playwright`.

## Skill 4 — Scraper GitHub
- Utiliser `git clone` ou l'interface CLI `gh` pour chercher, télécharger et intégrer des bibliothèques, shaders ou assets 100 % gratuits et open-source.
- Pour une fonctionnalité complexe, chercher d'abord un dépôt GitHub gratuit qui fait le travail avant de tout recoder de zéro.

## MCP Actifs (Model Context Protocol)

Serveurs configurés en local (portée machine, `claude mcp list`) :

- **github** — `npx -y @modelcontextprotocol/server-github` : recherche de dépôts, lecture de code/assets, intégration de projets open-source sans navigateur.
- **memory** — `npx -y @modelcontextprotocol/server-memory` : graphe de connaissances persistant (projet, règles UI/UX, préférences) sans reconsommer l'historique en tokens.
- **fetch** — `uvx mcp-server-fetch` : lecture de doc en ligne, recherche de modèles 3D CC0, récupération de shaders/assets web (HTML → markdown).
- **playwright** — `npx -y @playwright/mcp@latest` : automatisation navigateur (test UI/UX du hub, captures d'écran, responsive/accessibilité, débogage des jeux web).
- **sequential-thinking** — `npx -y @modelcontextprotocol/server-sequential-thinking` : raisonnement structuré par étapes pour la logique de jeu et l'architecture.

## Skills spécifiques actives

- **Game UI/UX** : architecture modulaire, responsive design, bonnes pratiques jeu vidéo.
- **3D Asset Pipeline** : récupérer des fichiers 3D (OBJ/GLTF) sur GitHub/sites CC0, ou générer du code 3D (Three.js/OpenSCAD).
- **Token Optimizer** : utiliser en priorité les serveurs MCP pour réduire les requêtes redondantes.

## Pipeline d'Assets — Outils & Méthodologie

### 3D (sources CC0)
- **Poly Haven** (`api.polyhaven.com`, CC0, sans token) : modèles, textures, HDRI.
  `python scripts/asset_fetcher.py search polyhaven <models|textures|hdris> <mot-clé>`
  `python scripts/asset_fetcher.py download polyhaven <asset_id> ./assets`
- **Sketchfab** (token requis `SKETCHFAB_TOKEN`) : recherche de modèles variés (armes, persos…).
  `python scripts/asset_fetcher.py search sketchfab "fantasy sword"`
- **Kenney.nl** (CC0, assets de jeu low-poly + sprites) : téléchargement manuel depuis le site.
- **Optimisation** : `gltf-pipeline -i in.gltf -o out.glb -d` (compression Draco).

### 2D (génération IA)
- **Local — ComfyUI** (RTX 5070 12 Go, illimité, hors ligne) — **installé** :
  - Emplacement : `C:\Users\basil\ComfyUI_windows_portable` (PyTorch 2.13 cu130 → Blackwell OK)
  - Lancer le serveur : `run_nvidia_gpu.bat` (interface web : http://127.0.0.1:8188)
  - Modèle : `ComfyUI\models\checkpoints\sd_xl_base_1.0.safetensors` (SDXL base, ~6,9 Go)
  - CLI : `python scripts/generate_image.py "une épée fantasy pixel art" --comfyui --out epee.png`
  - Options : `--size 1024x1024 --steps 20 --cfg 7 --seed 42`
- **Hébergé** (secours, sans GPU) : `HF_TOKEN` requis.
  `python scripts/generate_image.py "une épée fantasy pixel art" --out epee.png`

### UI/UX
- Thèmes/templates CSS open-source : chercher sur GitHub (ex. `animate.css`, `nes.css`, `98.css`).
- Visualiser/tester les interfaces avec le serveur MCP `playwright` (captures, responsive, a11y).

## Intégration de jeux open-source (dossier `games/`)

Le hub héberge des jeux tiers open-source **statiques** (en plus des mini-jeux maison du « Catalogue »).

### Structure
- `games/<jeu>/` — un jeu complet auto-suffisant (HTML/CSS/JS/ressources), servi tel quel par GitHub Pages.
  - Ex. `games/shapez/` (Shapez.io, GPL-3.0) : `index.html` + `bundle.js` + `main.css` + `res/`.
  - Ex. `games/mindustry/` (Mindustry Classic, GPL-3.0) : `index.html` (launcher) + `game.html` (app GWT) + `html/` + `assets/`.
- Jeux tiers = sauvegarde **locale** (localStorage) → **pas de gate Firebase** dans `script.js` ; lien direct `<a href="games/<jeu>/index.html">`.
- Référencés dans la section « 🏆 Classement des Meilleurs Jeux 2D » (`index.html`, `.featured-card`), **pas** dans le « Catalogue des Jeux » (mini-jeux maison, authentifiés).

### Méthodologie d'ajout d'un nouveau jeu
1. **Cloner** le dépôt officiel **hors du repo** (ex. `C:\Users\basil\shapez-build\`) pour ne pas polluer `games/` avec `node_modules`/sources.
2. **Builder** la version web statique (si npm requis) et récupérer **uniquement** le dossier `build/` final.
3. **Copier** le build dans `games/<jeu>/` — vérifier que les chemins (JS/CSS/assets) sont **relatifs** (`main.css`, `bundle.js`, `res/…`), jamais absolus (`/…`).
4. **Ajouter une carte** dans `index.html` (section classement) : titre, description des mécaniques, badge, bouton « Jouer maintenant », miniature (`<jeu>.png`).
5. **Tester localement** : `python -m http.server 8000` + playwright (ouvrir hub + jeu, capture d'écran, zéro erreur console).
6. **Documenter** ici (structure + spécificités du build).

### Build Shapez.io (spécifique)
- Repo : `tobspr-games/shapez.io` (GPL-3.0). ⚠️ La « Community Edition » ne supporte **plus** le build web.
- Toolchain : Node (webpack 4 → `NODE_OPTIONS=--openssl-legacy-provider` sur Node 17+), Yarn 1.22, **Java 17** (atlas de textures), **ffmpeg** (audio).
- Build : `cd gulp && yarn gulp build.web-shapezio` → sortie dans `build/` (copiée vers `games/shapez/`).
- **3 corrections requises** (déjà appliquées dans `C:\Users\basil\shapez-build\` ; à refaire si on reclone) :
  1. `gulp/node_modules/fluent-ffmpeg/lib/capabilities.js` : `formatRegexp` → `/^\s*([D ])([E ])\s+(\S+)\s+(.*)$/` (ffmpeg récent aligne le nom de format à droite).
  2. Copier `src/js/core/config.local.template.js` → `src/js/core/config.local.js` (la tâche `localConfig.findOrCreate` n'est pas incluse dans le build de prod).
  3. `src/js/core/cachebust.js` et `gulp/buildutils.js` : retourner le chemin **relatif** (pas `/v/<hash>/`) pour un hébergement statique en sous-dossier GitHub Pages.

### Build Mindustry (spécifique)
- Repo source : `Anuken/Mindustry-Classic` (GPL-3.0). ⚠️ Le build HTML5 (GWT) n'existe **que** sur la version Classic (build 40) ; les versions récentes l'ont abandonné.
- Build web récupéré **pré-compilé** depuis `minidogg/MindustryClassicMirror` (miroir du build HTML5 itch.io, dossier `web/`) → **aucune compilation GWT requise** (Java 8 + GWT serait trop lourd/fragile).
- Structure copiée vers `games/mindustry/` : `index.html` (launcher + export/import sauvegardes localStorage), `game.html` (app GWT), `html/` (`.nocache.js` + `.cache.js` compilé ~3,4 Mo), `assets/` (sprites/sons/musiques/cartes), `styles.css`, `title.png`, `soundmanager2-*`.
- **1 correction requise** : `index.html` → chemins **relatifs** `src="title.png"` et `href="game.html"` (au lieu de `/title.png`, `/game.html`).
- Sauvegarde **locale** (localStorage) → lien direct `<a href="games/mindustry/index.html">`, pas de gate Firebase.

### Build Survivor (spécifique)
- Repo source : `canvas-vampire-survivors` (MIT). Roguelite « Vampire Survivors-like », 100 % HTML5 Canvas, **zéro dépendance**, modules ES (`<script type="module">`).
- Structure copiée vers `games/survivor/` : `index.html`, `styles.css`, `src/` (23 fichiers JS), `hero.svg`, `LICENSE`.
- Corrections appliquées à `index.html` : suppression du `<link rel="manifest">` (PWA) + du script d'enregistrement du service worker, et chemins `./docs/hero.svg` / `./docs/og-card.svg` → `./hero.svg` (les `docs/` ne sont pas copiées).
- ⚠️ i18n **anglais + chinois uniquement** (pas de français). Premier lancement : 2 overlays à fermer (`#howtoClose` puis `#tutorialOfferNo`).
- Sauvegarde locale (localStorage) → lien direct, pas de gate Firebase.

### Build Sandspiel (spécifique)
- Repo source : `maxbittker/sandspiel` (MIT, « sandtable »). Jeu de sable qui tombe (Rust → WASM via wasm-pack + webpack 5).
- Build récupéré **pré-compilé** depuis la branche `gh-pages` (sortie webpack) → **aucune compilation Rust/wasm-pack requise**.
- Structure copiée vers `games/sandspiel/` : `index.html`, `main.<hash>.js` (runtime webpack), `728.<hash>.js` (glue wasm-bindgen, ~1 Mo), `86.<hash>.js` (UI), `<hash>.module.wasm`, `styles.css`, `assets/` (polices + icônes).
- **3 corrections requises** :
  1. `main.<hash>.js` : `l.p="/"` → `l.p=""` (publicPath webpack — pilote le chargement des chunks **et** le fetch du `.wasm` ; sans ça, tout casse en sous-dossier).
  2. `index.html` : chemins absolus → relatifs, suppression des scripts pubs/tracking (AdSense, Google Tag Manager, `a.sandspiel.club/app.js` + `/image.gif`) et du smart banner App Store.
  3. `86.<hash>.js` : retirer `(adsbygoogle=window.adsbygoogle||[]).push({})` (sinon `ReferenceError: adsbygoogle is not defined` au boot, le module étant en mode strict).
- Fichiers supprimés (poids mort) : `*.map`, `service-worker.js`, `workbox-*.js`, `manifest.json`, `assets/ads.txt`.
- Volet promo « PullTab » (Discord + App Store payant de l'auteur) masqué via `#PullTab{display:none}` dans `index.html`.
- ⚠️ Bouton « Upload » (partage) contacte le serveur de l'auteur (`a.sandspiel.club`) → échoue silencieusement hors-ligne. i18n **anglais uniquement**.
