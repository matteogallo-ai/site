"""Renders the Praxis still shown on the home page: one page of a published live briefing PDF,
fetched at its pinned commit and checked against its sha256.

--check (CI) compares decoded pixels, not PNG bytes: the page rendered from the pinned PDF and
the committed PNG must both decode to the pixels pinned in media.json. MuPDF rasterises in
software, so the same release gives the same pixels on every platform.
"""

import hashlib
import json
import sys
import urllib.request
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]


def pixels(pix: pymupdf.Pixmap) -> str:
    rgb = pymupdf.Pixmap(pymupdf.csRGB, pix) if pix.colorspace.n != 3 or pix.alpha else pix
    return hashlib.sha256(rgb.samples).hexdigest()


def render(pdf: bytes, page: int, zoom: float) -> pymupdf.Pixmap:
    with pymupdf.open(stream=pdf, filetype="pdf") as doc:
        return doc[page - 1].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)


def main() -> int:
    check = "--check" in sys.argv
    media = json.loads((ROOT / "src/data/media.json").read_text("utf-8"))["media"]
    failed = False
    for still in (m for m in media if "page" in m.get("from", {})):
        src = still["from"]
        url = f"https://raw.githubusercontent.com/{src['repo']}/{src['commit']}/{src['path']}"
        with urllib.request.urlopen(url, timeout=60) as response:
            pdf = response.read()
        digest = hashlib.sha256(pdf).hexdigest()
        if digest != src["sha256"]:
            raise SystemExit(f"{src['path']}: sha256 {digest} != pinned {src['sha256']}")
        rendered = render(pdf, src["page"], src["zoom"])
        file = ROOT / still["file"]
        if not check:
            rendered.save(file)
            print(f"{still['file']}: page {src['page']}, {rendered.width}x{rendered.height}, pixels {pixels(rendered)}")
            continue
        for what, got in (("rendered page", pixels(rendered)), (still["file"], pixels(pymupdf.Pixmap(str(file))))):
            if got != src["pixels_sha256"]:
                print(f"{what}: pixels {got} != pinned {src['pixels_sha256']}", file=sys.stderr)
                failed = True
    if failed:
        return 1
    if check:
        print("briefing pages: pixels match the pinned PDFs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
