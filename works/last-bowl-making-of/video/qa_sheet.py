#!/usr/bin/env python3
"""自检联系表：每屏在关键词出现 0.8 秒后抽一帧（没有关键词就抽中点），拼成一张图，标出屏号和时间。"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
MP4 = sys.argv[1]; OUTJ = sys.argv[2]
tl = json.load(open(os.path.join(HERE, 'src', 'timeline.json'), encoding='utf-8'))
pts = []
for s in tl['shots']:
    ts = [a + .8 for _, a in s['kw']] or [(s['at'] + s['end']) / 2]
    pts += [(s['id'], min(t, s['end'] - .1)) for t in ts]
pts += [('Ⅷ 片头', tl['end'] + 1.0), ('Ⅷ 片中', tl['end'] + 22.5), ('Ⅷ 片尾', tl['end'] + 42.0)]
tmp = os.path.join(HERE, 'out', 'qa'); os.makedirs(tmp, exist_ok=True)
font = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 22)
W, H, cols = 480, 270, 5
rows = (len(pts) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + 30)), (20, 20, 20)); d = ImageDraw.Draw(sheet)
for k, (sid, t) in enumerate(pts):
    p = os.path.join(tmp, f'{k:02d}.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', MP4, '-frames:v', '1', '-vf', f'scale={W}:{H}', p], check=True)
    x, y = (k % cols) * W, (k // cols) * (H + 30)
    sheet.paste(Image.open(p), (x, y + 30)); d.text((x + 6, y + 3), f'{sid}  {t:.1f}s', fill=(255, 210, 120), font=font)
sheet.save(OUTJ, quality=85); print(OUTJ, sheet.size, len(pts), '帧')
