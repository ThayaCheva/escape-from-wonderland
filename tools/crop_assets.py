"""Crop the owner's print sheets into per-card game assets.

Usage:
    python -I tools/crop_assets.py "<source folder>" public/assets [--contact-sheet]

Source sheets are A4 at 300 dpi (2492x3508) with a 3x3 grid of 750x1050 cards.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

# Grid on every card sheet (measured): left/top edge and cell size.
GRID_X0, GRID_Y0 = 120, 179
CELL_W, CELL_H = 750, 1050
INSET = 4  # trim so no neighbouring border shows
CARD_OUT = (500, 700)
TOKEN_OUT = 256

ACTIONS = [
    'drink-me', 'eat-me', 'vorpal-sword',
    'cheshire-cat', 'execution-order', 'dead-red-knight',
    'dead-white-knight', 'caterpillar', 'exile',
]
EVENTS = [
    'wq-generosity', 'tweedledee', 'tweedledum',
    'jabberwocky', 'mh-party', 'tea-of-confusion',
    'rabbit-hole', 'rq-decree', 'shadow-creatures',
]
# 10-13.jpg layout, row-major; None = blank cell.
TENS = ['R11', 'R12', 'R13', 'R10', None, 'W13', 'W12', 'W11', 'W10']

# Round tokens on new_token.jpg: approximate centres (x, y) and search radius.
TOKENS = {
    'plus1': (302, 1497, 260),
    'minus1': (302, 2502, 260),
    'alice-gold': (1512, 2610, 280),
    'alice-rose': (1996, 2610, 280),
    'alice-blue': (1512, 3124, 280),
    'alice-mint': (1996, 3124, 280),
}

NAVY = (42, 45, 55)
GOLD = (184, 151, 79)


def cell(sheet: Image.Image, index: int) -> Image.Image:
    row, col = divmod(index, 3)
    x = GRID_X0 + col * CELL_W
    y = GRID_Y0 + row * CELL_H
    box = (x + INSET, y + INSET, x + CELL_W - INSET, y + CELL_H - INSET)
    return sheet.crop(box).resize(CARD_OUT, Image.LANCZOS)


def save_card(img: Image.Image, out: Path, name: str, made: list) -> None:
    path = out / 'cards' / f'{name}.jpg'
    img.save(path, quality=88)
    made.append((name, path))


def round_token(sheet: Image.Image, cx: int, cy: int, r: int) -> Image.Image:
    """Find the circle's bounding box near (cx, cy) and return it masked to a circle."""
    region = sheet.crop((cx - r, cy - r, cx + r, cy + r))
    gray = region.convert('L')
    mask = gray.point(lambda v: 255 if v < 248 else 0)
    # keep only the shape connected to the centre (drops slivers of neighbouring tokens)
    ImageDraw.floodfill(mask, (r, r), 128)
    component = mask.point(lambda v: 255 if v == 128 else 0)
    bbox = component.getbbox()
    if not bbox:
        raise SystemExit(f'No token found near {(cx, cy)}')
    l, t, rgt, b = bbox
    size = max(rgt - l, b - t)
    mx, my = (l + rgt) // 2, (t + b) // 2
    square = region.crop((mx - size // 2, my - size // 2, mx + size // 2, my + size // 2))
    square = square.resize((TOKEN_OUT, TOKEN_OUT), Image.LANCZOS).convert('RGBA')
    circle = Image.new('L', (TOKEN_OUT * 4, TOKEN_OUT * 4), 0)
    ImageDraw.Draw(circle).ellipse((6, 6, TOKEN_OUT * 4 - 6, TOKEN_OUT * 4 - 6), fill=255)
    square.putalpha(circle.resize((TOKEN_OUT, TOKEN_OUT), Image.LANCZOS))
    return square


def card_back(src: Path) -> Image.Image:
    art = Image.open(src / 'card.png').convert('L').resize(CARD_OUT, Image.LANCZOS)
    lines = ImageOps.invert(art)  # line art becomes bright
    back = Image.new('RGB', CARD_OUT, NAVY)
    gold = Image.new('RGB', CARD_OUT, GOLD)
    back.paste(gold, (0, 0), lines)
    return back


def resize_width(img: Image.Image, width: int) -> Image.Image:
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 2:
        raise SystemExit(__doc__)
    src, out = Path(args[0]), Path(args[1])
    (out / 'cards').mkdir(parents=True, exist_ok=True)
    (out / 'tokens').mkdir(parents=True, exist_ok=True)
    made: list = []

    for color, sheet_name in (('R', '1-9-red.jpg'), ('W', '1-9-white.jpg')):
        sheet = Image.open(src / sheet_name).convert('RGB')
        for i in range(9):
            save_card(cell(sheet, i), out, f'{color}{i + 1}', made)
    tens = Image.open(src / '10-13.jpg').convert('RGB')
    for i, name in enumerate(TENS):
        if name:
            save_card(cell(tens, i), out, name, made)
    for sheet_name, names in (('new_action.jpg', ACTIONS), ('new_event.jpg', EVENTS)):
        sheet = Image.open(src / sheet_name).convert('RGB')
        for i, name in enumerate(names):
            save_card(cell(sheet, i), out, name, made)

    tokens_sheet = Image.open(src / 'new_token.jpg').convert('RGB')
    save_card(cell(tokens_sheet, 0), out, 'vines', made)
    for name, (cx, cy, r) in TOKENS.items():
        path = out / 'tokens' / f'{name}.png'
        round_token(tokens_sheet, cx, cy, r).save(path, optimize=True)
        made.append((name, path))

    back = card_back(src)
    back.save(out / 'cards' / 'back.jpg', quality=90)
    made.append(('back', out / 'cards' / 'back.jpg'))

    resize_width(Image.open(src / 'wonderland_board.jpg').convert('RGB'), 2475).save(out / 'board.jpg', quality=85)
    for name in ('title.jpg', 'background.jpg'):
        resize_width(Image.open(src / name).convert('RGB'), 1920).save(out / name, quality=85)

    if '--contact-sheet' in sys.argv:
        thumbs = [(n, Image.open(p).convert('RGBA')) for n, p in made]
        tw, th, cols = 125, 175, 12
        rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * tw, rows * (th + 20)), (255, 255, 255))
        draw = ImageDraw.Draw(sheet)
        for i, (n, im) in enumerate(thumbs):
            im.thumbnail((tw - 6, th - 6))
            x, y = (i % cols) * tw, (i // cols) * (th + 20)
            sheet.paste(im, (x + 3, y + 3), im)
            draw.text((x + 3, y + th), n, fill=(0, 0, 0))
        Path('scratch').mkdir(exist_ok=True)
        sheet.save('scratch/contact.png')
    print(f'wrote {len(made)} assets to {out}')


if __name__ == '__main__':
    main()
