#!/usr/bin/env python3
"""
asset_fetcher.py — Pipeline d'assets 3D/2D CC0 pour Joxia Games.

Sources :
  - Poly Haven (https://polyhaven.com) : modèles, textures, HDRI — 100% CC0,
    AUCUN token requis (API publique).
  - Sketchfab  (https://sketchfab.com) : recherche de modèles — nécessite un
    token perso (variable d'env SKETCHFAB_TOKEN, gratuit sur sketchfab.com).

Exemples :
  python asset_fetcher.py search polyhaven models sword
  python asset_fetcher.py download polyhaven <asset_id> ./assets
  python asset_fetcher.py search sketchfab "fantasy sword"
"""
import argparse
import json
import os
import sys

import requests

POLYHAVEN = "https://api.polyhaven.com"
SKETCHFAB = "https://api.sketchfab.com/v3"


# ---------------------------------------------------------------------------
# POLY HAVEN  (CC0, sans authentification)
# ---------------------------------------------------------------------------

def polyhaven_search(asset_type, query=None, categories=None):
    """Retourne une liste de {id, name} depuis l'API Poly Haven."""
    params = {"type": asset_type}  # type = models | textures | hdris | all
    if categories:
        params["categories"] = categories
    resp = requests.get(f"{POLYHAVEN}/assets", params=params, timeout=30)
    resp.raise_for_status()
    results = []
    for aid, meta in resp.json().items():
        name = meta.get("name", "")
        if query and query.lower() not in name.lower():
            continue
        results.append({"id": aid, "name": name})
    return results


def _best_url(files, kind):
    """Extrait l'URL de téléchargement la plus haute résolution pour un type de fichier."""
    # La structure Poly Haven est imbriquée : files[kind][resolution][fmt]["url"]
    node = files.get(kind)
    if not node:
        return None
    if isinstance(node, dict) and "url" in node:  # cas simple (ex: blend)
        return node["url"]
    # Sinon on descend dans les résolutions (2k > 1k > ...) et formats
    for res in ("4k", "2k", "1k", "512", "16k", "8k"):
        if res in node:
            for fmt, meta in node[res].items():
                if isinstance(meta, dict) and meta.get("url"):
                    return meta["url"]
    return None


def polyhaven_download(asset_id, out_dir):
    """Télécharge le meilleur fichier disponible d'un asset Poly Haven."""
    resp = requests.get(f"{POLYHAVEN}/assets/{asset_id}", timeout=30)
    resp.raise_for_status()
    files = resp.json().get("files", {})
    if not files:
        print(f"Aucun fichier téléchargeable pour {asset_id}")
        return None

    # Ordre de priorité selon le type d'asset
    url, ext = None, ""
    for kind in ("gltf", "fbx", "usd", "hdr", "exr", "blend", "Diffuse", "AO", "Normal"):
        u = _best_url(files, kind)
        if u:
            url, ext = u, kind
            break
    if not url:  # dernier recours : premier fichier avec une URL
        for kind, node in files.items():
            u = _best_url(files, kind)
            if u:
                url, ext = u, kind
                break
    if not url:
        print(f"Impossible de trouver un lien de téléchargement pour {asset_id}")
        return None

    os.makedirs(out_dir, exist_ok=True)
    fname = f"{asset_id}.{ext}" if not ext.endswith(("gltf", "fbx", "usd", "hdr", "exr", "blend")) else f"{asset_id}.{ext}"
    # formats "matériaux" (Diffuse/Normal/...) -> on garde une extension image
    if ext in ("Diffuse", "AO", "Normal", "Rough", "Displacement"):
        fname = f"{asset_id}_{ext}.jpg"

    dest = os.path.join(out_dir, fname)
    print(f"Téléchargement : {url}")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1024 * 256):
                f.write(chunk)
    print(f"OK -> {dest}")
    return dest


# ---------------------------------------------------------------------------
# SKETCHFAB  (nécessite SKETCHFAB_TOKEN)
# ---------------------------------------------------------------------------

def sketchfab_search(query, n=10):
    token = os.environ.get("SKETCHFAB_TOKEN")
    if not token:
        print("⚠️  SKETCHFAB_TOKEN non défini. Renseigne-le :", file=sys.stderr)
        print('   set SKETCHFAB_TOKEN=xxx   (Windows PowerShell : $env:SKETCHFAB_TOKEN="xxx")', file=sys.stderr)
        return []
    headers = {"Authorization": f"Token {token}"}
    resp = requests.get(
        f"{SKETCHFAB}/search",
        params={"type": "models", "q": query, "count": n, "downloadable": "true"},
        headers=headers, timeout=30,
    )
    resp.raise_for_status()
    return [{"id": m["uid"], "name": m["name"], "url": m.get("viewerUrl")}
            for m in resp.json().get("results", [])]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    # Console Windows en cp1252 : force l'UTF-8 pour que emojis/accents ne fassent pas planter print()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    p = argparse.ArgumentParser(description="Télécharge des assets 3D/2D CC0")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search")
    s.add_argument("source", choices=["polyhaven", "sketchfab"])
    s.add_argument("type_or_query", help="type Poly Haven (models/textures/hdris/all) OU requête Sketchfab")
    s.add_argument("query", nargs="?", help="mots-clés (Poly Haven)")
    s.add_argument("--categories", help="catégories Poly Haven (csv)")

    d = sub.add_parser("download")
    d.add_argument("source", choices=["polyhaven", "sketchfab"])
    d.add_argument("asset_id")
    d.add_argument("out_dir", nargs="?", default="./assets")

    args = p.parse_args()

    if args.cmd == "search":
        if args.source == "polyhaven":
            cats = args.categories.split(",") if args.categories else None
            for hit in polyhaven_search(args.type_or_query, args.query, cats):
                print(f"{hit['id']}  —  {hit['name']}")
        else:  # sketchfab
            for hit in sketchfab_search(args.type_or_query):
                print(f"{hit['id']}  —  {hit['name']}  ({hit['url']})")

    elif args.cmd == "download":
        if args.source == "polyhaven":
            polyhaven_download(args.asset_id, args.out_dir)
        else:
            print("Sketchfab : le téléchargement via API nécessite l'UID + acceptation des CGU.")
            print("Télécharge manuellement depuis la page du modèle, ou ouvre une issue pour automatiser.")


if __name__ == "__main__":
    main()
