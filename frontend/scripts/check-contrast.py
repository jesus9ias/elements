"""WCAG contrast audit for the design tokens.

Local developer tool — makes no network calls and is never run by CI/CD. Run it
after ANY change to a color, fill or tint token:

    python scripts/check-contrast.py

Every surface in this interface is translucent, so comparing raw token values
would be meaningless. This models the real compositing stack instead:

    page background  ->  glass surface     ->  text
    page background  ->  category cell fill ->  text

and reports the worst case over both extremes of the page background (the
darkest point, and the lightest point under the warm glow).

Two criteria are checked, and they pull in opposite directions:

    1.4.3  text contrast   text vs the surface behind it       4.5:1
    1.4.11 non-text        a cell's edge vs the page behind it 3.0:1

Making the category fill brighter improves how a cell reads against the page
but degrades text on top of it. The border carries 1.4.11 on its own, which is
why it — not the fill — is where "brighter cells" is bought.

Exits non-zero if anything falls below its threshold.
"""

import io
import math
import re
import sys
from pathlib import Path

TOKENS_PATH = Path(__file__).resolve().parent.parent / 'src' / 'styles' / 'tokens.css'

AA_NORMAL = 4.5
AA_NONTEXT = 3.0  # WCAG 1.4.11, for UI component boundaries

CATEGORIES = [
    'alkali-metal',
    'alkaline-earth-metal',
    'transition-metal',
    'post-transition-metal',
    'metalloid',
    'nonmetal',
    'halogen',
    'noble-gas',
    'lanthanide',
    'actinide',
]

GLASS_TIERS = {
    'bar': ('glass-bar-top', 'glass-bar-bottom'),
    'panel': ('glass-panel-top', 'glass-panel-bottom'),
    'raised': ('glass-raised-top', 'glass-raised-bottom'),
}

TEXT_TOKENS = [
    'color-text',
    'color-text-strong',
    'color-text-muted',
    'color-text-subtle',
    'color-accent',
    'color-warning',
]


# --- color math ------------------------------------------------------------


def oklch_to_linear(lightness, chroma, hue_deg):
    hue = math.radians(hue_deg)
    a, b = chroma * math.cos(hue), chroma * math.sin(hue)
    l_ = lightness + 0.3963377774 * a + 0.2158037573 * b
    m_ = lightness - 0.1055613458 * a - 0.0638541728 * b
    s_ = lightness - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_**3, m_**3, s_**3
    return [
        max(0.0, min(1.0, v))
        for v in (
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
        )
    ]


def hex_to_linear(value):
    value = value.lstrip('#')
    channels = [int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return [
        ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in channels
    ]


def over(source, alpha, backdrop):
    """Source-over compositing, in linear light."""
    return [f * alpha + b * (1 - alpha) for f, b in zip(source, backdrop)]


def mix(color_a, color_b, share_of_a):
    """Approximates `color-mix()` with `share_of_a` as a percentage."""
    ratio = share_of_a / 100
    return [a * ratio + b * (1 - ratio) for a, b in zip(color_a, color_b)]


def contrast(fg, bg):
    def luminance(c):
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

    high, low = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (high + 0.05) / (low + 0.05)


# --- token reading ---------------------------------------------------------

CSS = io.open(TOKENS_PATH, encoding='utf-8-sig').read()


def token(name):
    match = re.search(r'--' + re.escape(name) + r':\s*([^;]+);', CSS)
    if match is None:
        raise SystemExit(f'token --{name} not found in {TOKENS_PATH}')
    return match.group(1).strip()


def color(name):
    """A color token as (linear rgb, alpha)."""
    value = token(name)
    if value.startswith('#'):
        return hex_to_linear(value), 1.0
    match = re.match(r'oklch\(([\d.]+) ([\d.]+) ([\d.]+)(?: / ([\d.]+))?\)', value)
    if match is None:
        raise SystemExit(f'token --{name} is not a hex or oklch color: {value}')
    return (
        oklch_to_linear(*(float(match.group(i)) for i in (1, 2, 3))),
        float(match.group(4)) if match.group(4) else 1.0,
    )


def percent(name):
    return float(token(name).rstrip('%'))


# --- audit -----------------------------------------------------------------

failures = []


def record(what, where, ratio, threshold=AA_NORMAL):
    if ratio < threshold:
        failures.append((what, where, ratio, threshold))
    return ratio


def main():
    # The two extremes of the page background: no glow, and full warm glow.
    glow, glow_alpha = color('color-bg-glow-warm')
    pages = {
        'darkest page': color('color-bg-end')[0],
        'lightest page': over(glow, glow_alpha, color('color-bg-start')[0]),
    }

    surfaces = {}
    for tier, stops in GLASS_TIERS.items():
        for position, name in zip(('top', 'bottom'), stops):
            fill, alpha = color(name)
            for page_name, page in pages.items():
                surfaces[f'{tier} {position} / {page_name}'] = over(fill, alpha, page)

    print('=== TEXT TOKENS ON GLASS SURFACES ===')
    for name in TEXT_TOKENS:
        fg = color(name)[0]
        where = min(surfaces, key=lambda s: contrast(fg, surfaces[s]))
        ratio = record(name, where, contrast(fg, surfaces[where]))
        print(f'  {name:<22} {ratio:5.2f}:1   ({where})')

    white = color('color-text-strong')[0]
    roles = [
        ('symbol', lambda base: white),
        ('number', lambda base: mix(white, base, percent('tint-number'))),
        ('name', lambda base: mix(white, base, percent('tint-name'))),
        ('mass', lambda base: mix(white, base, percent('tint-mass'))),
    ]

    for heading, fill_token, shown in (
        ('ELEMENT CELL TEXT ON ITS CATEGORY FILL', 'cell-fill-top', roles),
        ('DETAIL BADGE TEXT ON ITS CATEGORY FILL', 'badge-fill-top', roles[:2]),
    ):
        print(f'\n=== {heading} ===')
        density = percent(fill_token) / 100
        print('  ' + 'category'.ljust(24) + ''.join(r.rjust(10) for r, _ in shown))
        for category in CATEGORIES:
            base = color('category-' + category)[0]
            ratios = []
            for role, make in shown:
                where = min(pages, key=lambda p: contrast(make(base), over(base, density, pages[p])))
                ratios.append(
                    record(
                        f'{heading.split()[1].lower()} {role}',
                        f'{category} / {where}',
                        contrast(make(base), over(base, density, pages[where])),
                    )
                )
            print('  ' + category.ljust(24) + ''.join(f'{r:9.2f}:' for r in ratios))

    print('\n=== CELL EDGE vs PAGE (WCAG 1.4.11 non-text, needs 3:1) ===')
    print('  This is what "the cells sink into the background" measures. It is')
    print('  carried by the border alone and is independent of the fill.')
    border_alpha = percent('cell-border-alpha') / 100
    border_tint = percent('cell-border-tint')
    for category in CATEGORIES:
        base = color('category-' + category)[0]
        edge = mix(white, base, border_tint)
        where = min(pages, key=lambda p: contrast(over(edge, border_alpha, pages[p]), pages[p]))
        ratio = contrast(over(edge, border_alpha, pages[where]), pages[where])
        record(f'cell edge {category}', where, ratio, AA_NONTEXT)
        print(f'  {category:<24} {ratio:5.2f}:1')

    print('\n=== CATEGORY COLOR AS TEXT (detail category label, on glass) ===')
    for category in CATEGORIES:
        fg = color('category-' + category)[0]
        where = min(surfaces, key=lambda s: contrast(fg, surfaces[s]))
        ratio = record(f'category label {category}', where, contrast(fg, surfaces[where]))
        print(f'  {category:<24} {ratio:5.2f}:1')

    print()
    if failures:
        print(f'!! {len(failures)} pair(s) below threshold:')
        for what, where, ratio, threshold in failures:
            print(f'   {what} on {where}: {ratio:.2f}:1 (needs {threshold})')
        return 1

    print(f'All checked pairs meet WCAG AA '
          f'({AA_NORMAL}:1 text, {AA_NONTEXT}:1 non-text).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
