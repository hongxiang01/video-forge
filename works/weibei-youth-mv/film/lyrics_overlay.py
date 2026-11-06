"""歌词版字幕层：剪纸字（米色纸 + 纤维 + 白毛边 + 投影），按逐字时间弹出，唱完一句往下落出画面。
输出 lyrics_ov/fNNNNN.png（RGBA，1920x1080），再用 ffmpeg 叠到无字版上。用法：lyrics_overlay.py 起秒 止秒 fps"""
import json, math, os, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
t0, t1, fps = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
song = json.load(open('song.json'))
FONT = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 84, index=1)
rng = np.random.default_rng(3)
def chip(ch):
    S = 130; m = Image.new('L', (S, S)); d = ImageDraw.Draw(m); d.text((S / 2, S / 2), ch, font=FONT, fill=255, anchor='mm')
    a = np.asarray(m).astype(float) / 255
    from scipy import ndimage as nd
    jag = nd.gaussian_filter(rng.normal(0, 1, (S, S)), 1.2) * 0.6
    rim = np.clip(nd.gaussian_filter(nd.binary_dilation(a > 0.5, iterations=7).astype(float), 0.8) + jag * 0.08, 0, 1)
    paper = np.zeros((S, S, 3)); paper[:] = (242, 233, 214); paper += nd.gaussian_filter(rng.normal(0, 9, (S, S)), 0.7)[..., None]
    ink = np.zeros((S, S, 3)); ink[:] = (196, 72, 44); ink += nd.gaussian_filter(rng.normal(0, 8, (S, S)), 0.8)[..., None]   # 红色卡纸字
    rgb = paper * (1 - a[..., None]) + ink * a[..., None]
    shadow = nd.gaussian_filter(np.roll(np.roll(rim, 5, 0), 4, 1), 2.2) * 0.32
    out = np.zeros((S, S, 4)); out[..., :3] = rgb * rim[..., None]; al = np.maximum(rim, shadow)
    out[..., :3] = np.where(rim[..., None] > 0.5, rgb, np.array([48, 30, 18])); out[..., 3] = al * 255
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA')
lines = []
for L in song['lines']:
    chars = [c for c in L['chars']]
    sprites = [chip(c['c']) if c['c'].strip() else None for c in chars]
    rots = rng.uniform(-6, 6, len(chars))
    lines.append((L, chars, sprites, rots))
os.makedirs('lyrics_ov', exist_ok=True)
W, H, step = 1920, 1080, 92
for f in range(round(t0 * fps), round(t1 * fps)):
    t = f / fps; can = Image.new('RGBA', (W, H))
    for L, chars, sprites, rots in lines:
        end = L.get('sung_end', L['t1']) + 0.5
        if t < L['t0'] - 0.1 or t > end + 0.6: continue
        n = len(chars); x0 = W / 2 - (n - 1) * step / 2; y = 985
        fall = max(0, t - end) / 0.6
        for i, (c, sp, r) in enumerate(zip(chars, sprites, rots)):
            if sp is None: continue
            u = (t - c['t']) / 0.18
            if u < 0: continue
            sc = 1 + 0.25 * math.sin(min(u, 1) * math.pi) if u < 1 else 1
            sc *= min(1, 0.3 + u)
            dy = 260 * fall ** 2 + 18 * math.sin(i * 1.7) * fall; rr = r + 25 * fall * (1 if i % 2 else -1)
            s = sp.resize((int(130 * sc), int(130 * sc))).rotate(rr, resample=Image.BICUBIC, expand=True)
            can.alpha_composite(s, (int(x0 + i * step - s.width / 2), int(y + dy - s.height / 2)))
    can.save(f'lyrics_ov/f{f:05d}.png', compress_level=1)
print('done')
