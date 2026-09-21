#!/usr/bin/env python3
"""
generate_image.py — Génération d'images 2D par IA (textures, sprites, UI, concept art).

Deux modes :
  1. HOSTED — Hugging Face Inference API (gratuit, sans GPU local, limite de débit).
     Nécessite la variable d'environnement HF_TOKEN.
  2. LOCAL  — ComfyUI / Stable Diffusion sur le GPU RTX 5070 (illimité, hors ligne).
     Lance d'abord le serveur ComfyUI (run_nvidia_gpu.bat), qui écoute sur 127.0.0.1:8188.

Usage :
  # Hébergé (Hugging Face)
  python generate_image.py "une épée fantasy, pixel art" --out epee.png

  # Local (ComfyUI + SDXL)
  python generate_image.py "une épée fantasy, pixel art" --comfyui --out epee.png
  python generate_image.py "texture bois, seamless" --comfyui --size 1024x1024 --steps 20
  python generate_image.py "UI button glassmorphism" --comfyui --seed 42 --out bouton.png
"""
import argparse
import os
import sys
import time
import uuid

import requests

DEFAULT_MODEL = "black-forest-labs/FLUX.1-schnell"  # rapide + dispo en tier gratuit
HF_API = "https://api-inference.huggingface.co/models"

DEFAULT_CHECKPOINT = "sd_xl_base_1.0.safetensors"
COMFY_URL = "http://127.0.0.1:8188"


def generate_hf(prompt, model, token, negative_prompt=None):
    """Appelle l'API d'inférence Hugging Face et renvoie les octets de l'image."""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"inputs": prompt}
    if negative_prompt:
        payload["parameters"] = {"negative_prompt": negative_prompt}

    url = f"{HF_API}/{model}"
    # Gère le "cold start" (le modèle se charge, l'API renvoie 503 avec estimated_time)
    for attempt in range(8):
        resp = requests.post(url, headers=headers, json=payload, timeout=120)
        if resp.status_code == 200:
            return resp.content
        data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        if resp.status_code == 503 and "estimated_time" in data:
            wait = min(data["estimated_time"] + 2, 40)
            print(f"Modèle en cours de chargement… attente {wait:.0f}s")
            time.sleep(wait)
            continue
        raise RuntimeError(f"Erreur API {resp.status_code}: {resp.text[:300]}")
    raise RuntimeError("Temps d'attente dépassé (cold start trop long)")


def _sdxl_workflow(checkpoint, prompt, negative, width, height, steps, cfg, seed):
    """Construit un workflow SDXL txt2img minimal pour l'API ComfyUI."""
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": checkpoint}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["4", 1]}},
        "3": {"class_type": "KSampler", "inputs": {
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0],
            "latent_image": ["5", 0], "seed": seed, "steps": steps, "cfg": cfg,
            "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "joxia", "images": ["8", 0]}},
    }


def comfyui_generate(prompt, negative, out, checkpoint, width, height, steps, cfg, seed, base_url=COMFY_URL):
    """Envoie un prompt à ComfyUI, attend le résultat et l'enregistre dans `out`."""
    wf = _sdxl_workflow(checkpoint, prompt, negative, width, height, steps, cfg, seed)
    client_id = str(uuid.uuid4())
    resp = requests.post(f"{base_url}/prompt", json={"prompt": wf, "client_id": client_id}, timeout=60)
    resp.raise_for_status()
    prompt_id = resp.json()["prompt_id"]
    print(f"ComfyUI : job {prompt_id} soumis ({steps} steps, cfg {cfg}, {width}x{height})")

    image = None
    for _ in range(300):  # max ~5 min
        time.sleep(2)
        h = requests.get(f"{base_url}/history/{prompt_id}", timeout=30).json()
        if prompt_id not in h:
            continue
        for node in h[prompt_id].get("outputs", {}).values():
            if node.get("images"):
                image = node["images"][0]
                break
        if image:
            break
    if not image:
        raise RuntimeError("ComfyUI n'a pas produit d'image (timeout ou erreur). "
                           "Vérifie que le serveur tourne et que le checkpoint est présent.")

    img = requests.get(f"{base_url}/view", params={
        "filename": image["filename"],
        "subfolder": image.get("subfolder", ""),
        "type": image.get("type", "output"),
    }, timeout=60).content
    with open(out, "wb") as f:
        f.write(img)
    print(f"✅ Image enregistrée : {out} ({len(img)//1024} Ko)")


def main():
    # Console Windows en cp1252 : force l'UTF-8 pour que emojis/accents ne fassent pas planter print()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    p = argparse.ArgumentParser(description="Génère une image 2D par IA")
    p.add_argument("prompt")
    p.add_argument("--out", default="output.png", help="fichier de sortie")
    p.add_argument("--negative", default="lowres, bad anatomy, blurry, watermark, jpeg artifacts",
                   help="negative prompt")
    p.add_argument("--model", default=DEFAULT_MODEL)
    # ComfyUI local
    p.add_argument("--comfyui", action="store_true", help="utiliser ComfyUI local (127.0.0.1:8188)")
    p.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT)
    p.add_argument("--size", default="1024x1024", help="largeur x hauteur")
    p.add_argument("--steps", type=int, default=20)
    p.add_argument("--cfg", type=float, default=7.0)
    p.add_argument("--seed", type=int, default=-1, help="-1 = aléatoire")
    args = p.parse_args()

    if args.comfyui:
        w, h = (int(x) for x in args.size.lower().split("x"))
        seed = args.seed if args.seed >= 0 else int(time.time()) % (2 ** 31)
        comfyui_generate(args.prompt, args.negative, args.out, args.checkpoint,
                         w, h, args.steps, args.cfg, seed)
        return

    token = os.environ.get("HF_TOKEN")
    if not token:
        print("⚠️  HF_TOKEN non défini. Crée un token gratuit sur https://huggingface.co/settings/tokens")
        print('   puis :  $env:HF_TOKEN="hf_xxx"  (PowerShell)')
        return

    print(f"Génération : {args.prompt!r}\nModèle     : {args.model}")
    img = generate_hf(args.prompt, args.model, token, args.negative)
    with open(args.out, "wb") as f:
        f.write(img)
    print(f"✅ Image enregistrée : {args.out} ({len(img)//1024} Ko)")


if __name__ == "__main__":
    main()
