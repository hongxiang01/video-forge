# 评审联系表：每个镜头均匀取 8 帧（4×2），另做几条关键动作的连续帧条（每 2 帧取 1，共 12 格）
# 用法：review_sheets.py 帧目录 输出目录。CUTS 是各镜头起点（小节线），MOT 是要看连续帧的动作（起秒, 隔几帧取一张），换片子时改这两张表
import sys, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; fps = 30
CUTS = [0, 5.65, 11.37, 17.09, 22.81, 28.53, 33.54, 39.26, 44.98, 50.70, 56.42, 62.14, 67.14, 72.86, 76.97, 81.44, 87.16, 90.02, 92.88, 95.74, 98.60, 104.32, 110.04, 115.76, 118.62, 122.91, 128.63, 137.21, 147.03]
def tile(k, w=480):
    im = Image.open(f'{d}/f{k:05d}.png').convert('RGB').resize((w, w * 9 // 16))
    ImageDraw.Draw(im).text((6, 4), f'{k / fps:.2f}s', fill=(255, 255, 0)); return im
for s in range(len(CUTS) - 1):
    a, b = CUTS[s], CUTS[s + 1]; ks = [round((a + (b - a) * (i + 0.5) / 8) * fps) for i in range(8)]
    S = Image.new('RGB', (480 * 4, 270 * 2))
    for i, k in enumerate(ks): S.paste(tile(k), ((i % 4) * 480, (i // 4) * 270))
    S.save(f'{out}/S{s + 1:02d}_{a:.1f}-{b:.1f}.jpg', quality=82)
MOT = {'hop_S03': (12.6, 2), 'feet_S04': (17.4, 2), 'wipe_S05': (23.3, 2), 'blink_S06': (31.2, 1), 'rise_S07': (33.6, 4), 'bell_S08': (41.7, 2), 'twirl_S09': (47.5, 2), 'hesitate_S10': (52.6, 4), 'flick_S11': (59.0, 2), 'catch_S13': (67.2, 3), 'door_S13': (68.5, 2), 'enter_S13': (70.8, 3), 'land_S15': (77.3, 2), 'star_S16': (82.8, 3), 'run_S17': (87.6, 2), 'spin_S18': (90.4, 2), 'boat_S19': (93.2, 4), 'release_S19': (94.7, 2), 'dock_S20': (97.8, 2), 'standup_S21': (101.2, 2), 'turn_S22': (107.2, 3), 'away_S23': (111.0, 4), 'face_S24': (117.1, 2), 'runback_S25': (118.6, 2), 'barrier_S25': (119.8, 2), 'push_S25': (120.6, 3), 'place_S26': (125.0, 3)}
for name, (t0, st) in MOT.items():
    ks = [round(t0 * fps) + st * i for i in range(12)]
    S = Image.new('RGB', (480 * 4, 270 * 3))
    for i, k in enumerate(ks): S.paste(tile(k), ((i % 4) * 480, (i // 4) * 270))
    S.save(f'{out}/motion_{name}.jpg', quality=82)
print('ok', len(os.listdir(out)))
