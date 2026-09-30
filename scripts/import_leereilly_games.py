#!/usr/bin/env python3
"""
import_leereilly_games.py — Intègre au hub les jeux web open source de la liste
« Games on GitHub » (https://github.com/leereilly/games).

Méthode : un FORK GitHub par jeu (joxiagame/<jeu>-joxia), comme les autres jeux
tiers du hub. Le fork conserve tout le dépôt d'origine : historique, LICENSE,
en-têtes de copyright, assets (images, sons, scripts).
Le script AJOUTE seulement :
  - CREDITS.md          : auteur, dépôt original, licence, liste leereilly/games ;
  - un bandeau de crédits en tête du README (entre marqueurs, idempotent) ;
  - le traceur de temps de jeu du hub (tracker.js) avant </body> (--no-tracker pour l'éviter) ;
puis active GitHub Pages. Il ne modifie ni ne remplace JAMAIS un fichier de licence
(vérifié avant chaque commit).

Source des données : docs/leereilly-games/inventaire.csv (licence lue dans le
fichier LICENSE de chaque dépôt, langage, dossier servable, niveau d'intégration).

Prérequis : git + GitHub CLI connecté (`gh auth login`) avec droits sur l'organisation.

Exemples :
  python scripts/import_leereilly_games.py                     # aperçu (rien n'est modifié)
  python scripts/import_leereilly_games.py --only hextris-joxia --apply
  python scripts/import_leereilly_games.py --lot 1 --apply     # lot 1 : les 10 jeux au plus fort potentiel
  python scripts/import_leereilly_games.py --lots              # voir la composition des lots
  python scripts/import_leereilly_games.py --niveau build      # + jeux à compiler (fork seul, sans Pages)
"""
import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "docs", "leereilly-games", "inventaire.csv")
LIST_URL = "https://github.com/leereilly/games"
TRACKER = '<script type="module" src="https://joxiagame.github.io/Joxia-Games/tracker.js?game={gid}"></script>'
MARK_BEGIN, MARK_END = "<!-- joxia-credits -->", "<!-- /joxia-credits -->"
LICENSE_RE = re.compile(r"(^|/)(licen[cs]e|copying|unlicense)[^/]*$", re.I)

# Niveaux d'intégration (colonne « eligibilite » du CSV)
LEVELS = {
    "ok":    ["✅ Fork + Pages"],
    "build": ["✅ Fork + Pages", "⚙️ Fork + build"],
    "nc":    ["✅ Fork + Pages", "⚠️ Non commercial"],
}
PAGES_LEVEL = "✅ Fork + Pages"  # seuls ces jeux sont servables tels quels


# ---------------------------------------------------------------------------
# utilitaires
# ---------------------------------------------------------------------------
def run(cmd, cwd=None, check=True, input_=None):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, input=input_,
                       encoding="utf-8", errors="replace")
    if check and p.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)}\n{p.stderr.strip()}")
    return p


def gh_json(args):
    try:
        p = run(["gh", *args], check=False)
    except FileNotFoundError:  # gh absent : acceptable en mode aperçu
        return None
    if p.returncode != 0:
        return None
    try:
        return json.loads(p.stdout)
    except ValueError:
        return None


def game_id(slug):
    """Identifiant pour tracker.js / PLAY_LABELS : hextris-joxia -> HEXTRIS."""
    return re.sub(r"[^A-Z0-9]", "", slug.upper().replace("-JOXIA", ""))


def credits_md(g):
    return f"""# Crédits

**{g['nom']}** est un jeu open source créé par ses auteurs d'origine :

- Dépôt original : https://github.com/{g['depot']}
- Licence : **{g['licence']}** — voir le fichier `{g['fichier_licence'] or 'LICENSE'}` de ce dépôt (texte original, non modifié).
- Référencé dans la liste « Games on GitHub » : {LIST_URL}

Tous les droits sur le code, les graphismes, les sons et les autres ressources
appartiennent à leurs auteurs respectifs, selon les termes de la licence d'origine.
Les en-têtes de copyright des fichiers sources sont conservés tels quels.

## Modifications apportées par Joxia Games

Ce dépôt est un fork, hébergé sur GitHub Pages pour le hub Joxia Games
(https://joxiagame.github.io/Joxia-Games/). Seuls ajouts :

- ce fichier `CREDITS.md` et un bandeau de crédits en tête du README ;
- le script de suivi du temps de jeu du hub (`tracker.js`) avant `</body>`, si présent.

L'historique Git complet (commits des auteurs d'origine) est conservé.
"""


def credits_banner(g):
    return (f"{MARK_BEGIN}\n"
            f"> 🎮 **Fork Joxia Games** de [{g['depot']}](https://github.com/{g['depot']}) — "
            f"jeu original de ses auteurs, licence **{g['licence']}** (fichier `{g['fichier_licence'] or 'LICENSE'}` d'origine conservé). "
            f"Jouer : https://joxiagame.github.io/{g['slug']}/ · Crédits : [`CREDITS.md`](CREDITS.md) · "
            f"Liste source : [leereilly/games]({LIST_URL})\n"
            f"{MARK_END}\n\n")


def hub_card(g):
    tag = g["categorie"] or "Jeu web"
    return f"""                <a class="game-card disco" href="https://joxiagame.github.io/{g['slug']}/" target="_blank" rel="noopener">
                    <div class="game-card__cover"><img src="{g['slug'].replace('-joxia', '')}.png" alt="{g['nom']}" loading="lazy" decoding="async"></div>
                    <div class="game-card__content">
                        <h3>{g['nom']}</h3>
                        <p class="disco-sub">{tag} · {g['licence']}</p>
                        <div class="game-card__tags"><span>{tag}</span><span>Open source</span></div>
                    </div>
                </a>"""


# ---------------------------------------------------------------------------
# étapes
# ---------------------------------------------------------------------------
def ensure_fork(g, org, apply):
    full = f"{org}/{g['slug']}"
    info = gh_json(["repo", "view", full, "--json", "isFork,parent,defaultBranchRef"])
    if info:
        parent = (info.get("parent") or {})
        pname = f"{(parent.get('owner') or {}).get('login', '')}/{parent.get('name', '')}"
        if not info.get("isFork") or pname.lower() != g["depot"].lower():
            raise RuntimeError(f"{full} existe déjà et n'est pas un fork de {g['depot']} : choisis un autre nom.")
        print(f"   fork déjà présent : {full}")
        return info["defaultBranchRef"]["name"]
    cmd = ["gh", "repo", "fork", g["depot"], "--org", org, "--fork-name", g["slug"],
           "--clone=false", "--default-branch-only"]
    print("   $ " + " ".join(cmd))
    if not apply:
        return None
    run(cmd)
    for _ in range(30):  # le fork met quelques secondes à être disponible
        info = gh_json(["repo", "view", full, "--json", "defaultBranchRef"])
        if info and info.get("defaultBranchRef"):
            return info["defaultBranchRef"]["name"]
        time.sleep(2)
    raise RuntimeError(f"fork {full} introuvable après 60 s")


def add_credits(g, org, branch, workdir, tracker, apply):
    full = f"{org}/{g['slug']}"
    print(f"   + CREDITS.md, bandeau README{', tracker.js, .nojekyll' if tracker and g['pages_dir'] else ''} → commit sur {branch or '<branche par défaut>'}")
    if not apply:
        return
    d = os.path.join(workdir, g["slug"])
    shutil.rmtree(d, ignore_errors=True)
    run(["git", "clone", "--depth", "1", f"https://github.com/{full}.git", d])
    files = run(["git", "ls-files"], cwd=d).stdout.splitlines()

    # 1) la licence d'origine doit être là (le fork la conserve) — on ne la touche pas
    if g["fichier_licence"] and g["fichier_licence"] not in files:
        raise RuntimeError(f"fichier de licence {g['fichier_licence']} absent du fork : arrêt pour ce jeu")

    # 2) CREDITS.md (fichier ajouté, jamais à la place d'un fichier existant de l'auteur)
    cred = os.path.join(d, "CREDITS.md")
    if "CREDITS.md" in files:
        with open(cred, encoding="utf-8", errors="replace") as f:
            old = f.read()
        if "Joxia Games" not in old:
            cred = os.path.join(d, "CREDITS-JOXIA.md")  # l'auteur a déjà un CREDITS.md : on le garde
    with open(cred, "w", encoding="utf-8") as f:
        f.write(credits_md(g))

    # 3) bandeau en tête du README (le texte d'origine reste intact en dessous)
    readmes = [f for f in files if "/" not in f and re.fullmatch(r"readme(\.md|\.markdown)?", f, re.I)]
    path = os.path.join(d, readmes[0] if readmes else "README.md")
    body = ""
    if os.path.exists(path):
        with open(path, encoding="utf-8", errors="replace") as f:
            body = f.read()
        body = re.sub(re.escape(MARK_BEGIN) + r".*?" + re.escape(MARK_END) + r"\n*", "", body, flags=re.S)
    elif any(re.fullmatch(r"readme\.\w+", f, re.I) for f in files if "/" not in f):
        body = "Voir le README d'origine du projet (autre format) dans ce dépôt.\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(credits_banner(g) + body)

    # 4) traceur du hub, juste avant </body> de la page servie
    if tracker and g["pages_dir"]:
        idx = os.path.join(d, "" if g["pages_dir"] == "/" else "docs", "index.html")
        if os.path.exists(idx):
            with open(idx, encoding="utf-8", errors="replace") as f:
                html = f.read()
            if "tracker.js?game=" not in html and re.search(r"</body>", html, re.I):
                tag = TRACKER.format(gid=game_id(g["slug"]))
                html = re.sub(r"</body>", tag + "\n</body>", html, count=1, flags=re.I)
                with open(idx, "w", encoding="utf-8") as f:
                    f.write(html)

    # 4 bis) .nojekyll : sinon Pages (Jekyll) ignore les dossiers/fichiers commençant par « _ »
    if g["pages_dir"]:
        nj = os.path.join(d, "" if g["pages_dir"] == "/" else "docs", ".nojekyll")
        if not os.path.exists(nj):
            open(nj, "w").close()

    # 5) garde-fou : aucun fichier de licence modifié
    changed = run(["git", "status", "--porcelain"], cwd=d).stdout.splitlines()
    touched = [l[3:] for l in changed]
    bad = [f for f in touched if LICENSE_RE.search(f)]
    if bad:
        raise RuntimeError(f"fichier(s) de licence modifié(s) : {bad} — annulé")
    if not touched:
        print("   crédits déjà à jour")
        return
    run(["git", "add", "-A"], cwd=d)
    run(["git", "-c", "user.name=Joxia Games", "-c", "user.email=joxiagame@users.noreply.github.com",
         "commit", "-m", f"Crédits : jeu original {g['depot']} ({g['licence']}), hébergé par Joxia Games"], cwd=d)
    run(["git", "push", "origin", f"HEAD:{branch}"], cwd=d)


def enable_pages(g, org, branch, apply):
    full = f"{org}/{g['slug']}"
    payload = json.dumps({"source": {"branch": branch or "<branche>", "path": g["pages_dir"]}})
    print(f"   $ gh api -X POST repos/{full}/pages --input - <<< '{payload}'")
    if not apply:
        return
    p = run(["gh", "api", "-X", "POST", f"repos/{full}/pages", "--input", "-"], check=False, input_=payload)
    if p.returncode != 0 and "already" not in (p.stdout + p.stderr).lower():
        raise RuntimeError(f"activation Pages : {p.stderr.strip() or p.stdout.strip()}")


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="exécuter (sinon : aperçu, rien n'est modifié)")
    ap.add_argument("--org", default="joxiagame", help="organisation/compte cible (défaut : joxiagame)")
    ap.add_argument("--niveau", choices=LEVELS, default="ok",
                    help="ok = jeux ✅ servables tels quels (défaut) ; build = + jeux à compiler ; nc = + licences non commerciales")
    ap.add_argument("--only", action="append", default=[], help="slug, dépôt ou nom (répétable)")
    ap.add_argument("--limit", type=int, default=0, help="nombre maximum de jeux")
    ap.add_argument("--lot", type=int, default=0, help="n'importer qu'un lot de 10 (1 = plus fort potentiel, voir docs/leereilly-games/LOTS.md)")
    ap.add_argument("--lots", action="store_true", help="afficher la composition des lots et quitter")
    ap.add_argument("--no-tracker", action="store_true", help="ne pas ajouter tracker.js")
    ap.add_argument("--workdir", default=os.path.join(tempfile.gettempdir(), "joxia-leereilly"))
    a = ap.parse_args()

    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if a.lots:
        lots = {}
        for g in rows:
            if g.get("lot"):
                lots.setdefault(int(g["lot"]), []).append(g)
        for n in sorted(lots):
            print(f"Lot {n} :")
            for g in sorted(lots[n], key=lambda g: -int(g["potentiel"] or 0)):
                print(f"   {g['potentiel']:>3}  {g['nom']}  ({g['slug']})")
        return
    if a.lot:  # un lot est une sélection validée : il prime sur --niveau
        games = sorted([g for g in rows if g.get("lot") == str(a.lot)], key=lambda g: -int(g["potentiel"] or 0))
    else:
        games = [g for g in rows if g["slug"] and g["eligibilite"] in LEVELS[a.niveau]]
    if a.only:
        keys = {k.lower() for k in a.only}
        games = [g for g in games if {g["slug"].lower(), g["depot"].lower(), g["nom"].lower()} & keys]
    if a.limit:
        games = games[: a.limit]
    if not games:
        sys.exit("Aucun jeu ne correspond.")

    if a.apply:
        if run(["gh", "auth", "status"], check=False).returncode != 0:
            sys.exit("GitHub CLI non connecté : lance `gh auth login`.")
        os.makedirs(a.workdir, exist_ok=True)
    print(f"{'EXÉCUTION' if a.apply else 'APERÇU (ajoute --apply pour exécuter)'} — {len(games)} jeu(x) → {a.org}\n")

    done, failed = [], []
    for i, g in enumerate(games, 1):
        print(f"[{i}/{len(games)}] {g['nom']}  ({g['depot']}, {g['licence']}, {g['langage']})  →  {a.org}/{g['slug']}")
        try:
            branch = ensure_fork(g, a.org, a.apply)
            add_credits(g, a.org, branch, a.workdir, not a.no_tracker, a.apply)
            if g["eligibilite"] == PAGES_LEVEL:
                enable_pages(g, a.org, branch, a.apply)
                print(f"   → https://{a.org}.github.io/{g['slug']}/")
            else:
                print("   → à compiler/adapter avant d'activer Pages (voir le README du jeu)")
            done.append(g)
        except Exception as e:  # on continue avec les jeux suivants
            print(f"   ✗ {e}")
            failed.append((g, str(e)))
        if a.apply:
            time.sleep(2)  # ménage l'API GitHub

    print(f"\nTerminé : {len(done)} ok, {len(failed)} en échec.")
    for g, e in failed:
        print(f"  ✗ {g['slug']} : {e.splitlines()[0]}")
    ok = [g for g in done if g["eligibilite"] == PAGES_LEVEL]
    if ok:
        out = os.path.join(a.workdir, "cartes-hub.html")
        if a.apply:
            with open(out, "w", encoding="utf-8") as f:
                f.write("\n".join(hub_card(g) for g in ok) + "\n")
            print(f"\nCartes pour index.html (section « Découvre aussi ») : {out}")
            print("Miniatures à ajouter dans le hub : " + ", ".join(g["slug"].replace("-joxia", "") + ".png" for g in ok))
        if not a.no_tracker:
            print("\nÀ ajouter dans PLAY_LABELS (admin/admin.js) :")
            print("    " + ", ".join(f"{json.dumps(game_id(g['slug']))}: {json.dumps(g['nom'], ensure_ascii=False)}" for g in ok) + ",")


if __name__ == "__main__":
    main()
