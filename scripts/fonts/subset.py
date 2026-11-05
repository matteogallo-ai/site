"""Build the site's font subsets and their licences into src/assets/fonts/.

Reproducible: upstream files pinned by tag and sha256, tools pinned by hash
(requirements.txt), no timestamps. CI re-runs this script and fails on any
difference with the committed files.

Usage, from the repo root: .venv/bin/python scripts/fonts/subset.py
"""

from __future__ import annotations

import hashlib
import io
import json
import time
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "assets" / "fonts"
RAW = "https://raw.githubusercontent.com/"

# (path under raw.githubusercontent.com, sha256)
INTER = ("rsms/inter/v4.1/docs/font-files/InterVariable.woff2", "693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3")
INTER_LICENSE = ("rsms/inter/v4.1/LICENSE.txt", "262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a")
SERIF = ("adobe-fonts/source-serif/4.005R/VAR/SourceSerif4Variable-Roman.ttf", "14d360ee1b76655da9276628b229e11671bc1f5d1083636144db6677d452cf55")
SERIF_LICENSE = ("adobe-fonts/source-serif/4.005R/LICENSE.md", "75784a295293a8992f5a8d99210566e0064a012e6dab6731305e3787f15896c7")
MONO = ("JetBrains/JetBrainsMono/v2.304/fonts/variable/JetBrainsMono%5Bwght%5D.ttf", "662a196d58f1183bf2d77428b6d5283fe3f45161ab021bea4036bc98e5cac016")
MONO_LICENSE = ("JetBrains/JetBrainsMono/v2.304/OFL.txt", "30f0c136e3c88e422d0791acd97238870f9054a9729bc34cf2ff0d4ed8cac4ad")

OFL_NOTICE = "This Font Software is licensed under the SIL Open Font License, Version 1.1."


def cps(*ranges: tuple[int, int]) -> list[int]:
    return sorted({c for lo, hi in ranges for c in range(lo, hi + 1)})


# Latin-1 plus French typography: « » ‹ ›, no-break, thin and narrow no-break spaces,
# typographic quotes and apostrophe, hyphen and dashes, ellipsis, œ Œ Ÿ, €.
# Not U+2011 (Source Serif 4 has no non-breaking hyphen) nor U+00AD (soft hyphen, Inter has none; never drawn).
TEXT = cps(
    (0x20, 0x7E), (0xA0, 0xAC), (0xAE, 0xFF), (0x152, 0x153), (0x178, 0x178),
    (0x2009, 0x2009), (0x2010, 0x2010), (0x2013, 0x2014), (0x2018, 0x2019),
    (0x201C, 0x201D), (0x2026, 0x2026), (0x202F, 0x202F), (0x2039, 0x203A), (0x20AC, 0x20AC),
)
# Measures and traces: ASCII, no-break space, ≥ ≤ ✓ ✗ · ‹ › €, κ (Cohen's kappa) and the
# en dash of ranges. JetBrains Mono has no U+202F,
# so French-formatted numbers in mono must use U+00A0 (the glyph test enforces it).
MONO_CPS = cps((0x20, 0x7E), (0xA0, 0xA0), (0xB7, 0xB7), (0x3BA, 0x3BA), (0x2013, 0x2013), (0x2039, 0x203A),
               (0x20AC, 0x20AC), (0x2264, 0x2265), (0x2713, 0x2713), (0x2717, 0x2717))


def fetch(source: tuple[str, str]) -> bytes:
    path, expected = source
    for attempt in range(3):
        try:
            data = urllib.request.urlopen(RAW + path, timeout=60).read()
            break
        except OSError as error:  # network errors only: retried, then re-raised
            if attempt == 2:
                raise
            print(f"retry {path}: {error}")
            time.sleep(2 ** attempt)
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected:
        raise SystemExit(f"{path}: sha256 {digest} != pinned {expected}")
    return data


def load(source: tuple[str, str]) -> TTFont:
    return TTFont(io.BytesIO(fetch(source)), recalcTimestamp=False)


def rename(font: TTFont, family: str, style: str) -> None:
    """OFL: a modified font may not keep a Reserved Font Name ("Source" for Source Serif 4)."""
    names = font["name"]
    for record in list(names.names):
        if record.nameID in (1, 3, 4, 6, 16, 17, 21, 22, 25):
            names.removeNames(nameID=record.nameID)
    ps = f"{family.replace(' ', '')}-{style}"
    for name_id, value in ((1, family), (2, style), (3, ps), (4, f"{family} {style}"), (6, ps)):
        names.setName(value, name_id, 3, 1, 0x409)


def write(font: TTFont, unicodes: list[int], features: list[str], axes: dict, name: str) -> list[int]:
    """Subset first, then instance: limiting an axis on the full font trips fontTools' lazy gvar loading."""
    # The subsetter drops requested characters the source lacks without a word; fail instead.
    absent = [f"U+{c:04X}" for c in unicodes if c not in font.getBestCmap()]
    if absent:
        raise SystemExit(f"{name}: source font has no glyph for {', '.join(absent)}")
    options = subset.Options()
    options.layout_features = [*options.layout_features, *features]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    font = instancer.instantiateVariableFont(font, axes)
    # The licence travels inside the font (nameID 13/14), since the .txt files are not served.
    font["name"].setName(OFL_NOTICE, 13, 3, 1, 0x409)
    font["name"].setName("https://openfontlicense.org", 14, 3, 1, 0x409)
    font.flavor = "woff2"
    font.save(OUT / name, reorderTables=True)
    return sorted(font.getBestCmap())


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    coverage: dict[str, list[int]] = {}

    # wght only, limited to the 400-700 the site uses; opsz pinned to text optics (14):
    # headings get their display look from the SPEC's negative tracking instead.
    coverage["sans"] = write(load(INTER), TEXT, ["tnum", "case"], {"opsz": 14, "wght": (400, 700)}, "inter-wght.woff2")

    serif_cps: list[list[int]] = []
    for weight, style in ((400, "Regular"), (600, "Semibold")):
        serif = load(SERIF)
        rename(serif, "Site Serif", style)
        # opsz 16: the contract and quotes are set at the 16 px step of the SPEC scale.
        serif_cps.append(write(serif, TEXT, ["tnum"], {"wght": weight, "opsz": 16}, f"serif-{weight}.woff2"))
    # A character counts as covered only if both weights draw it.
    coverage["serif"] = sorted(set(serif_cps[0]) & set(serif_cps[1]))

    # One static weight: measures and traces never change weight, and the axis doubled the file.
    coverage["mono"] = write(load(MONO), MONO_CPS, [], {"wght": 400}, "mono-400.woff2")

    for source, file in ((INTER_LICENSE, "LICENSE-inter.txt"), (SERIF_LICENSE, "LICENSE-source-serif-4.md"), (MONO_LICENSE, "LICENSE-jetbrains-mono.txt")):
        (OUT / file).write_bytes(fetch(source))

    (OUT / "coverage.json").write_text(json.dumps(coverage, separators=(",", ":")) + "\n")
    for path in sorted(OUT.glob("*.woff2")):
        print(f"{path.stat().st_size:>7}  {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
