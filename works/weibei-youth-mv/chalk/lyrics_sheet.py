# 每句歌词在显示期间取 4 个时刻（成片 + 歌词层），每行放两句（8 格），查字有没有压到人
# 用法（在 chalk/ 下运行，读 song.json）：lyrics_sheet.py 帧目录 歌词层目录 输出.jpg 起句 止句
import json, sys
from PIL import Image, ImageDraw
FR, LY, OUT, a, b = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
L = json.load(open('song.json'))['lines']; tiles = []
for i in range(a - 1, b):
    ln = L[i]; chars = [c for c in ln['chars'] if c['c'].strip()]; t0 = chars[0]['t'] + 0.3; t1 = ln.get('sung_end', ln['t1']) + 0.5
    for k in range(4):
        t = t0 + (t1 - t0) * k / 3; f = round(t * 30)
        im = Image.open(f'{FR}/f{f:05d}.png').convert('RGBA'); im.alpha_composite(Image.open(f'{LY}/f{f:05d}.png').convert('RGBA'))
        im = im.convert('RGB').resize((480, 270)); ImageDraw.Draw(im).text((6, 4), f'{i + 1}  {t:.2f}s', fill=(255, 255, 0)); tiles.append(im)
rows = (len(tiles) + 7) // 8; S = Image.new('RGB', (480 * 8, 270 * rows))
for j, im in enumerate(tiles): S.paste(im, ((j % 8) * 480, (j // 8) * 270))
S.save(OUT, quality=82); print('ok')
