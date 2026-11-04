#!/usr/bin/env python3
"""从成片抽帧拼审片联系表：每个镜头取 4 帧（镜头内均分），每张联系表 = 一个章节，3 列网格，帧下标 镜头/时间/该时刻口播。
用法：review_sheets.py <mp4> <输出目录>"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
mp4, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t = json.load(open(f'{root}/script/timeline.json', encoding='utf-8'))
S = t['sentences']
firsts = ["S01","S04","S08","S10","S14","S18","S20","S24","S26","S31","S35","S37","S43","S45","S49","S53","S54"]
idx = {s['id']: i for i, s in enumerate(S)}
shots = []
for k, fid in enumerate(firsts):
    a = S[idx[fid]]['from']
    b = S[idx[firsts[k+1]]]['from'] - 15 if k + 1 < len(firsts) else t['total_frames'] - 5
    shots.append((f'SC{k+1:02d}', a, b, S[idx[fid]]['chapter']))
font = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 20)
def say(fr):
    for s in S:
        if s['from'] <= fr <= s['to'] + 10: return s['id'] + ' ' + s['text']
    return '（停顿）'
for ch in (1, 2, 3):
    cells = []
    for sc, a, b, c in shots:
        if c != ch: continue
        for j in range(4):
            fr = int(a + (b - a) * (j + 0.6) / 4.2)
            p = f'{out}/{sc}_{fr:05d}.jpg'
            if not os.path.exists(p):
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{fr/30:.3f}', '-i', mp4, '-frames:v', '1', '-vf', 'scale=640:-1', p], check=True)
            cells.append((p, f'{sc} f{fr} {fr/30:.1f}s', say(fr)))
    cols = 3; cw, chh = 640, 360 + 60
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * chh), 'white')
    d = ImageDraw.Draw(sheet)
    for i, (p, lab, line) in enumerate(cells):
        x, y = (i % cols) * cw, (i // cols) * chh
        sheet.paste(Image.open(p), (x, y))
        d.text((x + 6, y + 362), lab, fill='black', font=font)
        d.text((x + 6, y + 386), line[:30], fill=(90, 90, 90), font=font)
    sheet.save(f'{out}/sheet_ch{ch}.jpg', quality=80)
    print(f'{out}/sheet_ch{ch}.jpg', len(cells))
