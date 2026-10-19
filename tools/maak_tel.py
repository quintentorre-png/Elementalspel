"""Bouwt de site voor GitHub Pages, met de lichte telefoonversie erbij.
Draait vanzelf bij elke upload (zie .github/workflows/telefoon.yml). Doet drie dingen:
  1. kopieert alles naar _site (behalve .git, .github, tools)
  2. maakt van elke tekening in art/ een kleine art-tel/<naam>.webp op schermmaat;
     wat niet veranderd is, komt uit de bewaarde map .tel-cache (dus snel)
  3. schrijft bestanden.json: van elk bestand een vingerafdruk. De telefoon vergelijkt
     die en haalt alleen opnieuw op wat veranderd is."""
import os, sys, json, shutil, hashlib
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SITE = os.path.join(ROOT, "_site")
CACHE = os.path.join(ROOT, ".tel-cache")
KLEIN = ("kaart-", "licht-", "vak-", "aether-", "ruit-", "token-", "iconen", "inv-", "vonk-", "max-")
GROOT = ("bg-", "hz-", "overworld", "winkel-", "pt-", "eerste-", "decor")

def vinger(pad):
    h = hashlib.sha1()
    with open(pad, "rb") as f:
        for blok in iter(lambda: f.read(1 << 20), b""): h.update(blok)
    return h.hexdigest()[:16]

def maxzijde(n):
    if n.startswith(KLEIN): return 600
    if n.startswith(GROOT): return 1280
    return 1000

def omzetten(taak):
    bron, uit, n = taak
    im = Image.open(bron); im.load()
    alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if alpha else "RGB")
    m, s = maxzijde(n), max(im.size)
    if s > m: im = im.resize((round(im.width * m / s), round(im.height * m / s)), Image.LANCZOS)
    im.save(uit, "WEBP", quality=80, method=4)
    return n

def main():
    if os.path.exists(SITE): shutil.rmtree(SITE)
    shutil.copytree(ROOT, SITE, ignore=shutil.ignore_patterns(".git", ".github", "tools", ".tel-cache", "_site", "*.zip", "*.psd"))
    os.makedirs(os.path.join(CACHE, "webp"), exist_ok=True)
    bronnen_pad = os.path.join(CACHE, "bronnen.json")
    bronnen = json.load(open(bronnen_pad)) if os.path.exists(bronnen_pad) else {}
    art = os.path.join(ROOT, "art")
    taken, nieuw = [], {}
    for n in sorted(os.listdir(art)):
        if not n.lower().endswith((".png", ".jpg", ".jpeg")): continue
        bron = os.path.join(art, n)
        v = vinger(bron); nieuw[n] = v
        uit = os.path.join(CACHE, "webp", os.path.splitext(n)[0] + ".webp")
        if bronnen.get(n) != v or not os.path.exists(uit): taken.append((bron, uit, n))
    print(f"{len(nieuw)} tekeningen, {len(taken)} nieuw of veranderd")
    fouten = []
    with ProcessPoolExecutor() as ex:
        for t, r in zip(taken, ex.map(omzetten_veilig, taken)):
            if r is not True: fouten.append((t[2], r))
    for n, f in fouten: print("kon niet omzetten:", n, f); nieuw.pop(n, None)
    json.dump(nieuw, open(bronnen_pad, "w"))
    os.makedirs(os.path.join(SITE, "art-tel"), exist_ok=True)
    for n in nieuw:
        w = os.path.splitext(n)[0] + ".webp"
        shutil.copy2(os.path.join(CACHE, "webp", w), os.path.join(SITE, "art-tel", w))
    # de vingerafdrukken
    lijst = {}
    for map_, _, namen in os.walk(SITE):
        for n in namen:
            pad = os.path.relpath(os.path.join(map_, n), SITE).replace(os.sep, "/")
            if pad in ("bestanden.json", "sw.js"): continue
            if pad.startswith("art/") and pad.count("/") == 1 and pad.lower().endswith((".png", ".jpg", ".jpeg")):
                continue   # op de telefoon komt de webp, dus de grote png hoeft niet in de lijst
            lijst[pad] = vinger(os.path.join(map_, n))
    json.dump(lijst, open(os.path.join(SITE, "bestanden.json"), "w"), separators=(",", ":"))
    print(f"bestanden.json: {len(lijst)} bestanden")

def omzetten_veilig(t):
    try: omzetten(t); return True
    except Exception as e: return str(e)

if __name__ == "__main__":
    main()
