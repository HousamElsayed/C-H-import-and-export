#!/usr/bin/env python3
"""Splits one combined before|after photo into the two files the results slider needs, and writes the case file.

  python3 elite-plus/_src/split_result.py combined.jpg --id TR-001 --branch turkey --service hair-transplant \
      [--months 12] [--consent "form ref"] [--layout auto|side|stacked] [--swap] [--focus center|top] [--order 1]

- Finds the divider between the two photos (a plain line or gap near the middle); falls back to the exact middle.
- Crops both halves to the same size and the closest standard frame (4:3, 1:1 or 4:5) so the slider lines up.
- Writes elite-plus/assets/img/uploads/results/<id>-before.jpg / -after.jpg and elite-plus/_content/results/<id>.json.
- Left/top is taken as "before"; use --swap if the photo is the other way round.
Needs Pillow (pip install pillow). Review every output by eye: labels or logos burned into the photo stay in it.
"""
import argparse, json, os, re, statistics
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
IMG_DIR = os.path.join(SITE, "assets", "img", "uploads", "results")
CASE_DIR = os.path.join(SITE, "_content", "results")
FRAMES = [(4, 3), (1, 1), (4, 5)]
MAX_W = 1200


def line_profile(gray, axis):
    """Mean and spread of brightness for every column (axis=0) or row (axis=1)."""
    w, h = gray.size
    px = gray.load()
    n = w if axis == 0 else h
    step = max(1, (h if axis == 0 else w) // 300)
    out = []
    for i in range(n):
        vals = [px[i, j] if axis == 0 else px[j, i] for j in range(0, h if axis == 0 else w, step)]
        out.append((statistics.fmean(vals), statistics.pstdev(vals)))
    return out


def find_divider(img, axis):
    """Returns (start, end) of the divider band along the split axis, or the middle if none is found."""
    gray = ImageOps.grayscale(img)
    scale = 600 / max(gray.size)
    small = gray.resize((max(1, int(gray.width * scale)), max(1, int(gray.height * scale))))
    prof = line_profile(small, axis)
    n = len(prof)
    lo, hi = int(n * .35), int(n * .65)
    best = min(range(lo, hi), key=lambda i: prof[i][1])
    if prof[best][1] > 14:  # no clean line: photos touch; split in the middle
        mid = round((img.width if axis == 0 else img.height) / 2)
        return mid, mid
    a = b = best
    while a > lo and prof[a - 1][1] <= 14 and abs(prof[a - 1][0] - prof[best][0]) < 25: a -= 1
    while b < hi and prof[b + 1][1] <= 14 and abs(prof[b + 1][0] - prof[best][0]) < 25: b += 1
    return int(a / scale), int((b + 1) / scale)


def trim_border(img):
    """Removes a plain frame (white/black margin) around a half, if any."""
    bg = Image.new(img.mode, img.size, img.getpixel((0, 0)))
    from PIL import ImageChops
    diff = ImageChops.difference(img, bg).convert("L").point(lambda v: 255 if v > 18 else 0)
    box = diff.getbbox()
    if box and (box[2] - box[0]) > img.width * .6 and (box[3] - box[1]) > img.height * .6:
        return img.crop(box)
    return img


def fit_frame(img, w, h, focus):
    """Center (or top) crop to w:h."""
    target = w / h
    if img.width / img.height > target:
        nw = round(img.height * target); x = (img.width - nw) // 2
        return img.crop((x, 0, x + nw, img.height))
    nh = round(img.width / target); y = 0 if focus == "top" else (img.height - nh) // 2
    return img.crop((0, y, img.width, y + nh))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image"); ap.add_argument("--id", required=True); ap.add_argument("--branch", required=True, choices=["turkey", "egypt"])
    ap.add_argument("--service", required=True); ap.add_argument("--months", type=int); ap.add_argument("--consent", default=None)
    ap.add_argument("--layout", default="auto", choices=["auto", "side", "stacked"]); ap.add_argument("--swap", action="store_true")
    ap.add_argument("--focus", default="center", choices=["center", "top"]); ap.add_argument("--order", type=int)
    a = ap.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9-]+", a.id): raise SystemExit("--id: letters, numbers and dashes only")
    if not os.path.exists(os.path.join(SITE, "_content", "services", a.service + ".json")): raise SystemExit(f"--service: no treatment called {a.service}")

    img = ImageOps.exif_transpose(Image.open(a.image)).convert("RGB")
    layout = a.layout if a.layout != "auto" else ("side" if img.width >= img.height else "stacked")
    axis = 0 if layout == "side" else 1
    s, e = find_divider(img, axis)
    if axis == 0: parts = [img.crop((0, 0, s, img.height)), img.crop((e, 0, img.width, img.height))]
    else: parts = [img.crop((0, 0, img.width, s)), img.crop((0, e, img.width, img.height))]
    parts = [trim_border(p) for p in parts]
    if a.swap: parts.reverse()

    w, h = min(p.width for p in parts), min(p.height for p in parts)
    parts = [fit_frame(p, w, h, "center") for p in parts]  # same size first
    fw, fh = min(FRAMES, key=lambda f: abs(f[0] / f[1] - w / h))
    parts = [fit_frame(p, fw, fh, a.focus) for p in parts]
    if parts[0].width > MAX_W: parts = [p.resize((MAX_W, round(MAX_W * fh / fw)), Image.LANCZOS) for p in parts]

    os.makedirs(IMG_DIR, exist_ok=True); os.makedirs(CASE_DIR, exist_ok=True)
    names = []
    for label, p in zip(("before", "after"), parts):
        fn = f"{a.id.lower()}-{label}.jpg"
        p.save(os.path.join(IMG_DIR, fn), "JPEG", quality=84, optimize=True, progressive=True)
        names.append("uploads/results/" + fn)
    case = {"id": a.id, "branch": a.branch, "service": a.service, "before": names[0], "after": names[1], "aspect": f"{fw}/{fh}"}
    if a.months: case["months"] = a.months
    if a.order: case["order"] = a.order
    case["consentRef"] = a.consent  # null until the clinic confirms the signed consent form
    with open(os.path.join(CASE_DIR, a.id + ".json"), "w", encoding="utf-8") as f:
        json.dump(case, f, ensure_ascii=False, indent=2); f.write("\n")
    print(f"{a.id}: {layout} split at {s}-{e}px -> {parts[0].width}x{parts[0].height} ({fw}:{fh}) before={names[0]} after={names[1]}")


if __name__ == "__main__":
    main()
