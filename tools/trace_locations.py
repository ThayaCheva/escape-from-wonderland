"""Trace the five coloured location regions of the board into masks.

Usage:
    python -I tools/trace_locations.py public/assets/board.jpg public/assets/locations

Writes <out>/<location>.png (white with alpha = the region) at half the board's size,
and scratch/locations.png, an overlay of the traced outlines on the board for checking.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

PARCHMENT = (236, 232, 225)
THRESHOLD = 28  # colour distance from parchment that counts as "inside a region"
OPEN = 5  # opening size: removes pen lines thinner than this
# seed points (percent of width, height) inside each region; several seeds are joined
SEEDS = {
    'white-queen': [(27, 55)],
    'mad-hatter': [(37, 40)],
    'black-forest': [(50, 23)],
    'chess': [(68, 33)],
    'red-queen': [(64, 70)],
}
# White Queen's Castle is pale and breaks into fragments: gather every fragment in this box
# (percent: left, top, right, bottom), bridge them, and keep the shape joined to the seed.
GATHER = {'white-queen': (23, 40, 50, 82)}
CLOSE = 25
PATCHES = {'white-queen': [(29.5, 73, 43, 78.8)]}
OUTLINE = {
    'white-queen': (255, 255, 255),
    'mad-hatter': (0, 200, 0),
    'black-forest': (0, 120, 255),
    'chess': (255, 0, 255),
    'red-queen': (255, 60, 60),
}


def region_mask(board: Image.Image) -> Image.Image:
    diff = ImageChops.difference(board, Image.new('RGB', board.size, PARCHMENT))
    r, g, b = diff.split()
    strongest = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mask = strongest.point(lambda v: 255 if v > THRESHOLD else 0)
    return mask.filter(ImageFilter.MinFilter(OPEN)).filter(ImageFilter.MaxFilter(OPEN))


def trace(mask: Image.Image, seeds: list) -> Image.Image:
    w, h = mask.size
    work = mask.copy()
    for seed in seeds:
        x, y = int(seed[0] / 100 * w), int(seed[1] / 100 * h)
        if work.getpixel((x, y)) not in (255, 128):
            raise SystemExit(f'seed {seed} is not inside a region')
        if work.getpixel((x, y)) == 255:
            ImageDraw.floodfill(work, (x, y), 128)
    region = work.point(lambda v: 255 if v == 128 else 0)
    # fill holes: anything not reachable from the border and not the region is a hole
    outside = region.copy()
    ImageDraw.floodfill(outside, (0, 0), 100)
    filled = outside.point(lambda v: 0 if v == 100 else 255)
    return filled.filter(ImageFilter.MaxFilter(3))


def gather(mask: Image.Image, box: tuple, seed: tuple, others: Image.Image) -> Image.Image:
    w, h = mask.size
    l, t, r, b = (int(box[0] / 100 * w), int(box[1] / 100 * h), int(box[2] / 100 * w), int(box[3] / 100 * h))
    inside = Image.new('L', mask.size, 0)
    inside.paste(mask.crop((l, t, r, b)), (l, t))
    # never take pixels that belong (or nearly belong) to another region
    inside = ImageChops.subtract(inside, others.filter(ImageFilter.MaxFilter(9)))
    bridged = inside.filter(ImageFilter.MaxFilter(CLOSE)).filter(ImageFilter.MinFilter(CLOSE))
    region = trace(bridged, [seed])
    # the bottom edge fades into the parchment and leaves notches open to the outside; this
    # rectangle lies wholly inside the castle's true outline, so adding it only seals them
    for px in PATCHES.get('white-queen', []):
        ImageDraw.Draw(region).rectangle(
            (int(px[0] / 100 * w), int(px[1] / 100 * h), int(px[2] / 100 * w), int(px[3] / 100 * h)), fill=255
        )
    return region


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    board = Image.open(sys.argv[1]).convert('RGB')
    board = board.resize((board.width // 2, board.height // 2), Image.LANCZOS)
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    mask = region_mask(board)
    overlay = board.copy()
    regions = {name: trace(mask, seeds) for name, seeds in SEEDS.items() if name not in GATHER}
    others = Image.new('L', board.size, 0)
    for r in regions.values():
        others = ImageChops.lighter(others, r)
    for name, box in GATHER.items():
        regions[name] = gather(mask, box, SEEDS[name][0], others)
    for name in SEEDS:
        region = regions[name]
        img = Image.new('RGBA', board.size, (255, 255, 255, 0))
        img.putalpha(region)
        img.save(out / f'{name}.png', optimize=True)
        edge = ImageChops.difference(region.filter(ImageFilter.MaxFilter(5)), region)
        overlay.paste(Image.new('RGB', board.size, OUTLINE[name]), (0, 0), edge)
        print(f'{name}: {region.getbbox()}')
    Path('scratch').mkdir(exist_ok=True)
    overlay.save('scratch/locations.png')


if __name__ == '__main__':
    main()
