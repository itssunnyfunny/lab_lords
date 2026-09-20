# Original brand reference evidence

Reference inspected on 2026-09-20: the supplied `ChatGPT Image Sep 20, 2026,
11_30_59 AM.png` (1448 × 1086 pixels). The user's pasted request is the
instruction authority; the picture is the visual reference. The previous
Reading Grove interpretation is not the baseline for this correction.

## Palette

The seven specified values below are preserved from the user's request. The
eighth is a sample from the actual supplied image, not a claimed printed hex.

| Role | Value | Source |
| --- | --- | --- |
| Forest green | `#164D3B` | User-specified printed palette |
| Leaf green | `#22A06B` | User-specified printed palette |
| Sage | `#A7C957` | User-specified printed palette |
| Warm paper | `#FFF8EE` | User-specified printed palette |
| Bark brown | `#8B6F56` | User-specified printed palette |
| Floral peach | `#F4A261` | User-specified printed palette |
| Mist | `#E8F1EA` | User-specified printed palette |
| Sky blue | `#6EB6E4` | Sampled from the supplied PNG |

Sky-blue sampling used Pillow to open the original file as RGB without
resizing or saving it. Coordinates are zero-based, with the origin at the
top-left corner. The 17 × 17 square at inclusive **x = 785–801, y = 321–337**
lies inside the blue disk, away from its edge, highlights, and text. Taking
the median independently for R, G, and B across its 289 pixels gives
**RGB(110, 182, 228)**, or **`#6EB6E4`**. The centre pixel (793, 329) has the
same value. Channel ranges within the square are R = 109–112, G = 181–183,
B = 227–230. The small range reflects the reference's textured illustration;
the selected median is a stable interface token rather than a claim that
every pixel in the swatch is identical.

Reproduction snippet (read-only):

```python
from PIL import Image
from statistics import median

image = Image.open(reference_path).convert("RGB")
pixels = [image.getpixel((x, y))
          for y in range(321, 338)
          for x in range(785, 802)]
rgb = tuple(round(median(pixel[channel] for pixel in pixels))
            for channel in range(3))
assert image.size == (1448, 1086)
assert rgb == (110, 182, 228)
```

## Standalone public logo asset

[`public/brand-reference/open-book-leaf.svg`](../../public/brand-reference/open-book-leaf.svg)
is original vector artwork redrawn by Codex after directly viewing the
reference. It retains the reference's open book, paired green leaves, and
small warm flame in a clean 180 × 116 viewBox. It has no embedded raster,
external resource, script, font, crown, or flattened wordmark.

The silhouette is deliberately simplified for small navigation use: the
reference's painterly leaf shading becomes flat colour with restrained
translucent accents, and page shapes have fewer details. The flame uses the
specified floral peach, rather than adding an unspecified orange token.
The wordmark should remain accessible text in the consuming component.
If that surrounding link already has an accessible brand name, consume this
asset with an empty `alt` to avoid repeating that name. The standalone SVG
itself includes a title and description for direct viewing.

This asset does not replace the authenticated application's shared
`components/brand/AppLogo.tsx`. It is intended for the public homepage's
first visual-review outcome. It changes no routing, authentication, billing,
tenancy, localization, consent or stored-data behavior and needs no schema,
migration, saved-environment or deployment change.

This document records source evidence and asset provenance. It is not
visual approval or a claim that the complete homepage has passed validation.
