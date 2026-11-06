"""零件拆开摆一排、标关节点（红点），检查切得对不对。"""
import json
from PIL import Image, ImageDraw
R = json.load(open('rig_out.json'))
for ch, parts in R.items():
    tiles = []
    for k, p in parts.items():
        im = Image.open(p['file']); bg = Image.new('RGBA', im.size, (40, 60, 90, 255)); bg.alpha_composite(im)
        d = ImageDraw.Draw(bg); px, py = p['pivot'][0] - p['origin'][0], p['pivot'][1] - p['origin'][1]
        d.ellipse((px - 7, py - 7, px + 7, py + 7), fill=(255, 0, 0, 255)); d.text((6, 4), k, fill='yellow')
        tiles.append(bg)
    W = sum(t.width for t in tiles) + 12 * len(tiles); H = max(t.height for t in tiles)
    c = Image.new('RGB', (W, H), 'white'); x = 0
    for t in tiles: c.paste(t.convert('RGB'), (x, 0)); x += t.width + 12
    s = 1400 / W if W > 1400 else 1
    c.resize((int(W * s), int(H * s))).save(f'{ch}_exploded.jpg', quality=88)
