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
