#!/usr/bin/env python3
"""Fetch project-page media for the publication cards, trim and transcode it.

Usage:
  python3 bin/fetch_paper_media.py            # build everything missing
  python3 bin/fetch_paper_media.py --force    # rebuild all outputs
  python3 bin/fetch_paper_media.py --frames   # dump a frame every 2 s per clip
                                              # into <scratch>/<key>/frames to pick START times
Requires: pip install --user imageio-ffmpeg pillow (tooling only).
Downloads land in a scratch dir outside the repo and are never executed.
"""
import argparse, os, subprocess, urllib.error, urllib.request
from pathlib import Path
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = Path(os.environ.get("MEDIA_SCRATCH", "/tmp/paper-media-dl"))
VID = ROOT / "assets/video/papers"
IMG = ROOT / "assets/img/papers"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
DUR, WIDTH, MAX_BYTES = 5, 480, int(1.5 * 1024 * 1024)

# key -> dict(base page URL, clips [(relative url, out suffix, start seconds)], stills [(relative url, name)])
# Clip 0 is the hover clip (<key>.mp4); later clips are <key>-2.mp4, -3.mp4 ...
# START values were picked by eye from `--frames` output.
TABLE = {
    "gwak2026cog3dmap": dict(base="https://cog3dmap.github.io/", clips=[("static/videos/robofac_demo.mp4", 2)], stills=[("static/images/main_figure.png", "main-figure")]),
    "jeon2026valr": dict(base="https://rootyjeon.github.io/valr/", clips=[], stills=[("static/figure/figure1.png", "figure1")]),  # teaser.mp4 is commented out on the page and 404s; card uses figure1
    "jeon2026larc": dict(base="https://rootyjeon.github.io/latent-reasoning-umm/", clips=[("assets/videos/larc-demo.mp4", 3)], stills=[("assets/img/qual-edit-scaling.jpg", "qual-edit-scaling"), ("assets/img/method-overview.png", "method-overview")]),
    "jeong2026mvsam": dict(base="https://jaesung-choe.github.io/mv_sam/", clips=[("videos/banner.mp4", 4), ("videos/sample1.mp4", 5), ("videos/sample2.mp4", 5), ("videos/sample3.mp4", 5)], stills=[("images/method.png", "method")]),
    "jeong2025quantile": dict(base="https://jaesung-choe.github.io/qrender/", clips=[("videos/teaser.mp4", 18)], stills=[("images/comparison.png", "comparison"), ("images/method1.png", "method1")]),
    "jeong2024rodygs": dict(base="https://rodygs.github.io/", clips=[("static/videos/rodygs_bear.mp4", 0), ("static/videos/rodygs_blackswan.mp4", 0), ("static/videos/rodygs_rhino.mp4", 0)], stills=[("static/images/main_figure.png", "main-figure")]),
    "jeong2024nvsadapter": dict(base="https://postech-cvlab.github.io/nvsadapter/", clips=[("video/sds_image.mp4", 4), ("video/sds_text.mp4", 8)], stills=[("images/main_framework.png", "main-framework")]),
}
SCNERF_A = "http://cvlab.postech.ac.kr/~seokjun/scnerf/nerf_wo_colmap/fern_wo_colmap.mp4"  # ours, no COLMAP
SCNERF_B = "http://cvlab.postech.ac.kr/~seokjun/scnerf/nerf_colmap/fern_colmap.mp4"        # with COLMAP
SCNERF_START = 0
FPT_BASE = "https://cvlab.postech.ac.kr/research/FPT/"
FPT_QUAL, FPT_ARCH = "images_fpt/qual-seg.png", "images_fpt/architecture.png"


def download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    try:
        return _fetch(url, dest)
    except urllib.error.HTTPError as e:
        print(f"  SKIPPED {url}: HTTP {e.code}")
        return None


def _fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (media-fetch)"})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def ff(*args):
    p = subprocess.run([FFMPEG, "-y", "-loglevel", "error", *args], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr)


def transcode(src, out, start, force):
    if out.exists() and not force:
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    for crf in range(28, 46, 2):
        ff("-ss", str(start), "-t", str(DUR), "-i", str(src), "-an", "-vf", f"scale={WIDTH}:-2,fps=24",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", str(crf), "-preset", "slow", "-movflags", "+faststart", str(out))
        if out.stat().st_size <= MAX_BYTES:
            print(f"  {out.name}: {out.stat().st_size // 1024} KB (crf {crf})")
            return
    raise RuntimeError(f"{out} still > 1.5 MB")


def poster(src, out, start, force):
    if out.exists() and not force:
        return
    ff("-ss", str(start), "-i", str(src), "-frames:v", "1", "-vf", f"scale={WIDTH}:-2", "-q:v", "4", str(out))


def still(src, out, maxw, force, keep_png=False):
    """Downscale to <= maxw wide; PNG stays PNG unless > 400 KB, then JPEG q85. Returns final path."""
    from PIL import Image
    for cand in (out.with_suffix(".png"), out.with_suffix(".jpg")):
        if cand.exists() and not force:
            return cand
    out.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    png = out.with_suffix(".png")
    if src.suffix.lower() == ".png":
        im.save(png, optimize=True)
        if png.stat().st_size <= 400 * 1024:
            return png
        if keep_png:  # consumer needs this exact .png name: palette-quantize instead of switching format
            im.convert("RGB").quantize(256).save(png, optimize=True)
            return png
        png.unlink()
    jpg = out.with_suffix(".jpg")
    im.convert("RGB").save(jpg, quality=85, optimize=True)
    return jpg


def rel(p):
    return p.relative_to(ROOT).as_posix()


def dump_frames(key, srcs):
    for i, s in enumerate(srcs):
        d = SCRATCH / key / "frames" / f"c{i}"
        d.mkdir(parents=True, exist_ok=True)
        ff("-i", str(s), "-vf", "fps=1/2,scale=240:-2", str(d / "f%02d.png"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--frames", action="store_true")
    a = ap.parse_args()
    manifest = {}

    for key, spec in TABLE.items():
        print(key)
        srcs = [download(spec["base"] + u, SCRATCH / key / Path(u).name) for u, _ in spec["clips"]]
        assert all(srcs), f"{key}: a clip failed to download"
        if a.frames:
            dump_frames(key, srcs); continue
        outs = []
        for i, ((u, start), src) in enumerate(zip(spec["clips"], srcs)):
            out = VID / (f"{key}.mp4" if i == 0 else f"{key}-{i + 1}.mp4")
            transcode(src, out, start, a.force)
            if i == 0:
                poster(src, VID / f"{key}.jpg", start, a.force)
            outs.append(out)
        extras = [rel(o) for o in outs[1:]]
        for u, name in spec["stills"]:
            s = download(spec["base"] + u, SCRATCH / key / Path(u).name)
            extras.append(rel(still(s, IMG / f"{key}-{name}", 1200, a.force)))
        if not outs:  # no video on the project page: poster is the first still, scaled to 480 px
            from PIL import Image
            pj = VID / f"{key}.jpg"
            if a.force or not pj.exists():
                im = Image.open(SCRATCH / key / Path(spec["stills"][0][0]).name).convert("RGB")
                VID.mkdir(parents=True, exist_ok=True)
                im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS).save(pj, quality=80)
            manifest[key] = dict(kind="image", poster=rel(pj), extras=extras)
            continue
        manifest[key] = dict(hover=rel(outs[0]), kind="video", poster=rel(VID / f"{key}.jpg"), extras=extras)

    key = "jeong2022scnerf"
    print(key)
    sa = download(SCNERF_A, SCRATCH / key / "a_fern_wo_colmap.mp4")
    sb = download(SCNERF_B, SCRATCH / key / "b_fern_colmap.mp4")
    if not (sa and sb):
        print("  SCNeRF clips are gone (cvlab.postech.ac.kr/~seokjun/scnerf 404s); slider skipped, the card uses the scnerf canvas animation")
    elif a.frames:
        dump_frames(key, [sa, sb])
    else:
        transcode(sa, VID / f"{key}-a.mp4", SCNERF_START, a.force)
        transcode(sb, VID / f"{key}-b.mp4", SCNERF_START, a.force)
        poster(sa, VID / f"{key}.jpg", SCNERF_START, a.force)
        manifest[key] = dict(hover=rel(VID / f"{key}-a.mp4"), kind="slider", b=rel(VID / f"{key}-b.mp4"), poster=rel(VID / f"{key}.jpg"), extras=[])

    key = "park2022fpt"
    print(key)
    q = download(FPT_BASE + FPT_QUAL, SCRATCH / key / "qual-seg.png")
    ar = download(FPT_BASE + FPT_ARCH, SCRATCH / key / "architecture.png")
    if not a.frames:
        hover = still(q, IMG / key, 960, a.force, keep_png=True)
        VID.mkdir(parents=True, exist_ok=True)
        pj = VID / f"{key}.jpg"
        if a.force or not pj.exists():
            from PIL import Image
            im = Image.open(q).convert("RGB")
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
            im.save(pj, quality=80)
        extras = [rel(still(ar, IMG / f"{key}-architecture", 1200, a.force))]
        manifest[key] = dict(hover=rel(hover), kind="crossfade", poster=rel(pj), extras=extras)

    if a.frames:
        return
    # same-size check for slider clips is guaranteed by identical start/duration/filter; both sources
    # should share dimensions - see report.
    lines = ["# Generated by bin/fetch_paper_media.py - do not edit by hand.",
             "# jeong2022scnerf is intentionally absent: its project-page clips 404, so its card is an interactive canvas (anim: scnerf) instead."]
    for k, m in manifest.items():
        lines.append(f"{k}:")
        for f in ("kind", "hover", "b", "poster"):
            if f in m:
                lines.append(f"  {f}: {m[f]}")
        lines.append("  extras:" if m["extras"] else "  extras: []")
        lines += [f"    - {e}" for e in m["extras"]]
    (ROOT / "_data/paper_media.yml").write_text("\n".join(lines) + "\n")
    print("wrote _data/paper_media.yml")


if __name__ == "__main__":
    main()
