# Import par lots de 10 (jeux leereilly/games)

> Liste source : [leereilly/games](https://github.com/leereilly/games) (« Games on GitHub », archivée en 2025) — © Lee Reilly et ses contributeurs, licence [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Les noms, catégories et descriptions ci-dessous en sont issus (traduction/adaptation des colonnes par Joxia) ; cette liste dérivée est donc elle aussi sous **CC BY-NC-SA 4.0**. Chaque jeu reste la propriété de ses auteurs, sous sa propre licence.

Les 40 jeux web ✅ ont été **ouverts un par un dans Chromium** (serveur statique sous `/<slug>/`, comme GitHub Pages) : erreurs JS, fichiers manquants et capture d'écran. Le potentiel (/100) combine : qualité visuelle, gameplay complet, fonctionnement au test, compatibilité mobile, et absence de doublon avec les jeux maison.

Commandes (depuis `Joxia-Games/`, GitHub CLI connecté) :

```bash
python scripts/import_leereilly_games.py --lots          # composition des lots
python scripts/import_leereilly_games.py --lot 1         # aperçu du lot 1
python scripts/import_leereilly_games.py --lot 1 --apply # import du lot 1
```

Après chaque lot : vérifier les URL Pages, coller les cartes générées dans `index.html`, ajouter les miniatures et les `PLAY_LABELS`, puis passer au lot suivant.

## Lot 1 — les pépites

| # | Jeu | Potentiel | Licence | Auteur / dépôt | Test navigateur |
|:-:|---|:-:|---|---|---|
| 1 | [HexGL](https://joxiagame.github.io/hexgl-joxia/) | 97 | MIT | [`BKcore/HexGL`](https://github.com/BKcore/HexGL) | Course futuriste 3D (WebGL), rendu superbe, menus complets. |
| 2 | [A Dark Room](https://joxiagame.github.io/a-dark-room-joxia/) | 95 | MPL-2.0 | [`doublespeakgames/adarkroom`](https://github.com/doublespeakgames/adarkroom) | Jeu culte d'aventure textuelle incrémentale ; fonctionne (jQuery en https). |
| 3 | [3d.city](https://joxiagame.github.io/3d-city-joxia/) | 93 | GPL-3.0 | [`lo-th/3d.city`](https://github.com/lo-th/3d.city) | City-builder 3D (moteur Micropolis), menu Nouvelle partie / Charger. |
| 4 | [Tower Defense](https://joxiagame.github.io/tower-defense-joxia/) | 91 | MIT | [`Casmo/tower-defense`](https://github.com/Casmo/tower-defense) | Tower defense 3D, écran titre + menu Play. |
| 5 | [Hextris](https://joxiagame.github.io/hextris-joxia/) | 90 | GPL-3.0 | [`Hextris/hextris`](https://github.com/Hextris/hextris) | Puzzle hexagonal addictif, tactile. Contient des liens pub/app store de l'auteur. |
| 6 | [Pond](https://joxiagame.github.io/pond-joxia/) | 88 | GPL-3.0 | [`Zolmeister/pond`](https://github.com/Zolmeister/pond) | Jeu d'arcade néon fluide, très joli, jouable à la souris/tactile. |
| 7 | [Drakonas](https://joxiagame.github.io/drakonas-joxia/) | 86 | MIT | [`Casmo/Drakonas`](https://github.com/Casmo/Drakonas) | Shoot'em up avions 3D, menus boutique/options/scores. |
| 8 | [Raging Gardens](https://joxiagame.github.io/raging-gardens-joxia/) | 85 | MIT | [`petarov/game-off-2012`](https://github.com/petarov/game-off-2012) | Arcade (lapin vs carottes), direction artistique soignée. |
| 9 | [Particle Clicker](https://joxiagame.github.io/particle-clicker-joxia/) | 84 | MIT | [`particle-clicker/particle-clicker`](https://github.com/particle-clicker/particle-clicker) | Clicker sur la physique des particules (CERN), sauvegarde locale. |
| 10 | [Drunken Viking](https://joxiagame.github.io/drunken-viking-joxia/) | 82 | MIT | [`cxong/DrunkenViking`](https://github.com/cxong/DrunkenViking) | Arcade pixel art, écran titre soigné. |

## Lot 2 — très bons jeux, plus simples

| # | Jeu | Potentiel | Licence | Auteur / dépôt | Test navigateur |
|:-:|---|:-:|---|---|---|
| 1 | [Clumsy Bird](https://joxiagame.github.io/clumsy-bird-joxia/) | 80 | GPL-3.0 | [`ellisonleao/clumsy-bird`](https://github.com/ellisonleao/clumsy-bird) | Clone de Flappy Bird (melonJS) propre ; doublon partiel de Flappy Joxia. |
| 2 | [BitBot](https://joxiagame.github.io/bitbot-joxia/) | 78 | MIT | [`recardona/BitBot`](https://github.com/recardona/BitBot) | Puzzle de programmation/robot, graphismes réussis. |
| 3 | [Orbium](https://joxiagame.github.io/orbium-joxia/) | 77 | GPL-2.0 | [`bni/orbium`](https://github.com/bni/orbium) | Puzzle de billes, options son/tutoriel. |
| 4 | [Astry](https://joxiagame.github.io/astry-joxia/) | 75 | Unlicense | [`wwwtyro/Astray`](https://github.com/wwwtyro/Astray) | Labyrinthe 3D à bille (WebGL), ambiance sombre (touche H = aide). |
| 5 | [Hyperspace Garbage Collector](https://joxiagame.github.io/hyperspace-garbage-collector-joxia/) | 74 | MIT | [`razh/game-off-2013`](https://github.com/razh/game-off-2013) | Arcade spatiale, écran titre + Start. |
| 6 | [Space Invaders](https://joxiagame.github.io/space-invaders-joxia/) | 72 | MIT | [`StrykerKKD/SpaceInvaders`](https://github.com/StrykerKKD/SpaceInvaders) | Space Invaders jouable immédiatement (score, vies). |
| 7 | [SORADES 13K](https://joxiagame.github.io/sorades-13k-joxia/) | 71 | CC-BY-SA | [`maettig/starship-sorades-13k`](https://github.com/maettig/starship-sorades-13k) | Shoot'em up vertical de la JS13K (13 Ko !). |
| 8 | [Swap](https://joxiagame.github.io/swap-joxia/) | 70 | CC0-1.0 | [`nmoroze/swap`](https://github.com/nmoroze/swap) | Puzzle de niveaux (25 niveaux), flèches/WASD. |
| 9 | [Parity](https://joxiagame.github.io/parity-joxia/) | 69 | MIT | [`abejfehr/parity`](https://github.com/abejfehr/parity) | Puzzle de nombres minimaliste ; pubs de l'auteur dans la page. |
| 10 | [Matching Pairs](https://joxiagame.github.io/matching-pairs-joxia/) | 67 | MIT | [`gamedolphin/matching-pairs`](https://github.com/gamedolphin/matching-pairs) | Jeu de mémoire (paires), boutons Play/Music. |

## Lot 3 — corrects, plus modestes

| # | Jeu | Potentiel | Licence | Auteur / dépôt | Test navigateur |
|:-:|---|:-:|---|---|---|
| 1 | [Beatrix](https://joxiagame.github.io/beatrix-joxia/) | 64 | MIT | [`cxong/Beatrix`](https://github.com/cxong/Beatrix) | Petit jeu pixel art coloré. |
| 2 | [Coil](https://joxiagame.github.io/coil-joxia/) | 63 | MIT | [`leereilly/Coil`](https://github.com/leereilly/Coil) | Arcade minimaliste (encercler les ennemis). |
| 3 | [Asteroids](https://joxiagame.github.io/asteroids-joxia/) | 62 | MIT | [`dmcinnes/HTML5-Asteroids`](https://github.com/dmcinnes/HTML5-Asteroids) | Asteroids vectoriel, fonctionne (Espace pour démarrer). |
| 4 | [Alien Invasion](https://joxiagame.github.io/alien-invasion-joxia/) | 60 | MIT | [`cykod/AlienInvasion`](https://github.com/cykod/AlienInvasion) | Démo shoot'em up mobile, simple mais complète. |
| 5 | [Emberwind](https://joxiagame.github.io/emberwind-joxia/) | 58 | BSD-3-Clause | [`operasoftware/Emberwind`](https://github.com/operasoftware/Emberwind) | Plateforme HTML5 ambitieux mais très lourd (~136 Mo), sons en erreur. |
| 6 | [CyberPong](https://joxiagame.github.io/cyberpong-joxia/) | 56 | MIT | [`dreamtocode/Cyber-Pong`](https://github.com/dreamtocode/Cyber-Pong) | Pong 2 joueurs ; Modernizr chargé en http:// → à passer en https. |
| 7 | [Ski Free](https://joxiagame.github.io/ski-free-joxia/) | 55 | MIT | [`basicallydan/skifree.js`](https://github.com/basicallydan/skifree.js) | Remake de SkiFree (nom d'un jeu Microsoft), petit rendu. |
| 8 | [Blockrain.js](https://joxiagame.github.io/blockrain-js-joxia/) | 53 | MIT | [`Aerolab/blockrain.js`](https://github.com/Aerolab/blockrain.js) | Tetris jouable en démo de bibliothèque ; doublon de Tetris Joxia. |
| 9 | [3D Hartwing Chess Set](https://joxiagame.github.io/3d-hartwing-chess-set-joxia/) | 52 | MIT | [`juliangarnier/3D-Hartwig-chess-set`](https://github.com/juliangarnier/3D-Hartwig-chess-set) | Échiquier 3D CSS (pas d'IA) ; erreur JS au chargement à vérifier. |
| 10 | [The House](https://joxiagame.github.io/the-house-joxia/) | 50 | MIT | [`arturkot/the-house-game`](https://github.com/arturkot/the-house-game) | Petite aventure/horreur textuelle, très court. |

## Lot 4 — à corriger avant mise en ligne, ou doublons des jeux maison

| # | Jeu | Potentiel | Licence | Auteur / dépôt | Test navigateur |
|:-:|---|:-:|---|---|---|
| 1 | [Turkey Cooking Simulator](https://joxiagame.github.io/turkey-cooking-simulator-joxia/) | 48 | GPL-3.0 | [`fernjager/game-off-2013`](https://github.com/fernjager/game-off-2013) | CreateJS chargé en http:// → bloqué sur Pages (https) : corriger l'URL. |
| 2 | [I Spy A Ghost](https://joxiagame.github.io/i-spy-a-ghost-joxia/) | 46 | MIT | [`OmarShehata/I-Spy-A-Ghost`](https://github.com/OmarShehata/I-Spy-A-Ghost) | jQuery chargé en http:// → bloqué sur Pages : corriger l'URL. |
| 3 | [EKG Runner](https://joxiagame.github.io/ekg-runner-joxia/) | 44 | MIT | [`Myztiq/ekgrunner`](https://github.com/Myztiq/ekgrunner) | Chemins absolus /media/… → 404 sous /ekg-runner-joxia/ : rendre relatifs. |
| 4 | [Roguish](https://joxiagame.github.io/roguish-joxia/) | 42 | BSD-3-Clause | [`CamHenlin/Roguish`](https://github.com/CamHenlin/Roguish) | Images manquantes (290 erreurs) : à réparer. |
| 5 | [Ceros Snake](https://joxiagame.github.io/ceros-snake-joxia/) | 40 | Multiple : GPL + MIT + Apache | [`mjhasbach/ceros-snake`](https://github.com/mjhasbach/ceros-snake) | Bloqué sur « Loading » : dépend d'une base Firebase de l'auteur (ancien SDK). |
| 6 | [hurry!](https://joxiagame.github.io/hurry-joxia/) | 38 | MIT | [`hughsk/ludum-dare-27`](https://github.com/hughsk/ludum-dare-27) | Erreur Box2D au démarrage (écran vide). |
| 7 | [Snake_new](https://joxiagame.github.io/snake-new-joxia/) | 36 | MIT | [`RabiRoshan/snake_game`](https://github.com/RabiRoshan/snake_game) | Snake fonctionnel mais doublon de Snake Joxia. |
| 8 | [Flappy Bird](https://joxiagame.github.io/flappy-bird-oss-joxia/) | 34 | MIT (package.json) | [`hyspace/flappy`](https://github.com/hyspace/flappy) | Flappy Bird fonctionnel mais doublon de Flappy Joxia. |
| 9 | [2048](https://joxiagame.github.io/2048-oss-joxia/) | 32 | MIT | [`gabrielecirulli/2048`](https://github.com/gabrielecirulli/2048) | 2048 officiel fonctionnel mais doublon de 2048 Joxia. |
| 10 | [Snake](https://joxiagame.github.io/snake-oss-joxia/) | 30 | MIT | [`jrgdiz/snake`](https://github.com/jrgdiz/snake) | Page blanche au test, doublon de Snake Joxia. |

## Écartés au test (pas de lot)

| Jeu | Licence | Nouveau statut | Raison |
|---|---|---|---|
| [Avabranch](https://github.com/Zolmeister/avabranch) | MIT | ⚙️ Fork + build | Page quasi vide au test : à investiguer. |
| [Ball And Wall](https://github.com/budnix/ball-and-wall) | MIT | ⚙️ Fork + build | dist/ et bower_components/ absents : build requis. |
| [Coffee Snake](https://github.com/dommmel/coffee-snake) | GPL-3.0 | ⚙️ Fork + build | Sous-module atom/ absent : cloner avec --recursive. |
| [HotFix](https://github.com/sdrdis/hotfix) | MIT | ❌ Techno obsolète | Unity Web Player (plugin abandonné) : injouable. |
| [Space Crusade](https://github.com/Loopeex/space-crusade) | MIT | ⚙️ Fork + build | js/phaser.min.js et js/game.min.js absents : build requis. |
| [Blk Game](https://github.com/morozd/blk-game) | Apache-2.0 | 🖥️ Serveur requis | Voxel multijoueur, serveurs de jeu requis. |
| [cube-composer](https://github.com/sharkdp/cube-composer) | MIT | ⚙️ Fork + build | dist/main.js absent : build requis (PureScript). |
| [Prism](https://github.com/Zolmeister/prism) | MIT | ⚙️ Fork + build | dist/*.min.js absents : build requis. |
| [Shape Experiment](https://github.com/binarymax/shape) | MIT | 📚 Référencé (non jouable en navigateur) | Expérience de psychologie, pas un jeu. |

⚠️ Beaucoup de ces jeux (2012-2016) incluent encore Google Analytics, des boutons de partage ou des pubs de leurs auteurs : ces scripts restent dans les forks (code d'origine non modifié). À retirer au cas par cas si besoin, en le mentionnant dans `CREDITS.md`.
