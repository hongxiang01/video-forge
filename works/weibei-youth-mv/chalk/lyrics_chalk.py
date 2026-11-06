"""歌词版字幕层（粉笔字）：每个字按逐字时间从左到右"写"出来，一句唱完被擦掉；下一句开始前上一句一定擦完。
每句自动选位置：上 / 下两条 × 居中 / 靠左 / 靠右，挑字所占那块里人物和彩色画最少的（格子细线不算），字后面垫一层黑板色，格子线不会穿字。
主歌（第 1–6 句，大人在说）白粉笔；副歌（对青春说）暖色彩粉笔。用法：lyrics_chalk.py 帧目录 [起秒 止秒]；输出目录默认 out/lyr，可用环境变量 LYR 改"""
import json, os, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd
FR = sys.argv[1]; t0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0; t1 = float(sys.argv[3]) if len(sys.argv) > 3 else 147.03; fps = 30
song = json.load(open('song.json'))
fp = 'fonts/LXGWWenKai-Medium.ttf' if os.path.exists('fonts/LXGWWenKai-Medium.ttf') and os.path.getsize('fonts/LXGWWenKai-Medium.ttf') > 1e6 else '/System/Library/Fonts/Hiragino Sans GB.ttc'
FONT = ImageFont.truetype(fp, 92); R = np.random.default_rng(5)
W, H = 1920, 1080; BANDS = {'top': (40, 230, 132), 'bottom': (850, 1040, 950)}
WHITE, WARM = np.array([242, 240, 230]), [np.array([255, 170, 90]), np.array([255, 214, 110])]
def chalk_char(ch, col):
    S = 128; m = Image.new('L', (S, S)); ImageDraw.Draw(m).text((S / 2, S / 2), ch, font=FONT, fill=255, anchor='mm')
    a = np.asarray(m).astype(float) / 255
    hole = (nd.gaussian_filter(R.random((S, S)), 0.6) < 0.38) * 0.7
    streak = 0.86 + 0.14 * np.sin(np.arange(S)[None, :] * 0.9 + np.arange(S)[:, None] * 0.35)
    al = np.clip(a * (1 - hole) * streak, 0, 1)
    halo = np.clip(nd.gaussian_filter(nd.binary_dilation(a > 0.3, iterations=9).astype(float), 5) * 0.62, 0, 0.62)   # 字后面的黑板色
    rgb = np.where((al > halo)[..., None], col, np.array([16, 30, 23]))
    return np.dstack([rgb, np.maximum(al, halo) * 255])
step, S = 96, 128
def xstart(anchor, n):   # 第一个字的中心 x
    return {'center': W / 2 - (n - 1) * step / 2, 'left': 120 + S / 2, 'right': W - 120 - S / 2 - (n - 1) * step}[anchor]
_cache = {}
def frame(t):
    f = min(4410, round(t * fps))
    if f not in _cache:
        p = f'{FR}/f{f:05d}.png'
        if not os.path.exists(p): return None
        a = np.asarray(Image.open(p).convert('RGB').resize((W // 4, H // 4))).astype(float)
        lum = a.mean(2); sat = (a.max(2) - a.min(2)) / (a.max(2) + 1)
        mass = nd.uniform_filter(lum, 5) > 70            # 成片的亮面（人物、道具）；细格子线模糊后不够亮
        color = (sat > 0.35) & (lum > 50)                 # 彩色粉笔画
        _cache[f] = (mass, color, np.abs(np.diff(lum, axis=1)))
    return _cache[f]
def busy(t, band, anchor, n):
    fr = frame(t)
    if fr is None: return 0
    mass, color, grad = fr; y0, y1, _ = BANDS[band]; xs = xstart(anchor, n) - S / 2; xe = xs + (n - 1) * step + S
    sl = (slice(y0 // 4, y1 // 4), slice(max(0, int(xs) // 4), min(W, int(xe)) // 4))
    return 100 * mass[sl].mean() + 30 * color[sl].mean() + 0.5 * grad[sl].mean() + (0 if anchor == 'center' else 2)
def place(n, t0, hide):   # 在 6 个位置里挑：按第二挤的那一刻（持续压到脸不行；板擦、车轮这种一闪而过的不算）+ 0.3 × 平均
    samples = np.linspace(t0, max(t0 + 0.1, hide - 0.3), 12)
    sc = {(b, a): (lambda v: sorted(v)[-2] + 0.3 * np.mean(v))([busy(t, b, a, n) for t in samples]) for b in BANDS for a in ('center', 'left', 'right')}
    ba = min(sc, key=sc.get); return ba, sc[ba]
CUTS = [5.65, 11.37, 17.09, 22.81, 28.53, 33.54, 39.26, 44.98, 50.70, 56.42, 62.14, 67.14, 72.86, 76.97, 81.44, 87.16, 90.02, 92.88, 95.74, 98.60, 104.32, 107.18, 110.04, 115.76, 118.62, 122.91, 128.63, 137.21]
def cut_hide(t_last, hide):   # 唱完以后遇到切镜，就在切镜那一刻擦完，不把字带进下一个镜头
    c = [c for c in CUTS if t_last + 0.6 < c < hide]
    return c[0] if c else hide
FIX = {10: ('bottom', 'center')}   # 手动指定：第 10 句放在河下面的空处（第 7 版人群是整排白粉笔狐狸，占满上方）
TH = 8   # 超过这个分 = 有一刻压到人物；这时如果是 10 个字以上的长句，就在最靠中间的空格处拆成两半，各自找位置
L = song['lines']; lines = []
for i, ln in enumerate(L):
    chars = [c for c in ln['chars'] if c['c'].strip()]
    end = ln.get('sung_end', ln['t1']) + 0.6
    hide = cut_hide(chars[-1]['t'], min(end + 0.9, (L[i + 1]['t0'] - 0.12) if i + 1 < len(L) else end + 0.9))
    col = WHITE if i < 6 else WARM[i % 2]
    (band, anchor), score = place(len(chars), chars[0]['t'] - 0.05, hide)   # 从第一个字落笔开始算
    if i + 1 in FIX: (band, anchor), score = FIX[i + 1], 0
    ws = ln['text'].split(); cuts = [len(''.join(ws[:j])) for j in range(1, len(ws))]
    mid = min(cuts, key=lambda c: abs(c - len(chars) / 2)) if cuts else 0
    sizes = [mid, len(chars) - mid]
    if score > TH and len(chars) >= 10 and cuts and len(''.join(ws)) == len(chars):
        k0 = 0
        for j, nk in enumerate(sizes):
            g = chars[k0:k0 + nk]; k0 += nk
            gt0 = g[0]['t'] - 0.1; gh = (chars[k0]['t'] - 0.05) if k0 < len(chars) else hide   # 下半句第一个字落笔前，上半句已擦完
            (b2, a2), s2 = place(nk, gt0, gh)
            lines.append(dict(t0=gt0, chars=g, sp=[chalk_char(c['c'], col) for c in g], hide=gh, y=BANDS[b2][2], x0=xstart(a2, nk)))
            print(i + 1, ''.join(c['c'] for c in g), b2, a2, round(s2, 1), f'(整句 {round(score, 1)}，拆开)')
    else:
        lines.append(dict(t0=ln['t0'], chars=chars, sp=[chalk_char(c['c'], col) for c in chars], hide=hide, y=BANDS[band][2], x0=xstart(anchor, len(chars))))
        print(i + 1, ln['text'], band, anchor, round(score, 1))
OUT = os.environ.get('LYR', 'out/lyr'); os.makedirs(OUT, exist_ok=True)
for f in range(round(t0 * fps), round(t1 * fps)):
    t = f / fps; can = np.zeros((H, W, 4))
    for D in lines:
        chars, sp, hide = D['chars'], D['sp'], D['hide']
        if t < D['t0'] - 0.1 or t > hide: continue
        x0 = D['x0']
        wipe = np.clip((t - (hide - 0.45)) / 0.45, 0, 1)
        for k, (c, s) in enumerate(zip(chars, sp)):
            u = (t - c['t'] + 0.05) / 0.16
            if u <= 0: continue
            S = s.shape[0]; cut = int(S * min(1, u)); part = s.copy(); part[:, cut:, 3] = 0
            if wipe > 0: part[..., 3] *= (1 - wipe)
            cx, cy = int(x0 + k * step - S / 2), int(D['y'] - S / 2 + 6 * np.sin(k * 1.7))
            reg = can[cy:cy + S, cx:cx + S]; a = part[..., 3:4] / 255
            reg[..., :3] = reg[..., :3] * (1 - a) + part[..., :3] * a; reg[..., 3:4] = np.maximum(reg[..., 3:4], part[..., 3:4])
    Image.fromarray(can.clip(0, 255).astype(np.uint8), 'RGBA').save(f'{OUT}/f{f:05d}.png', compress_level=1)
print('ok', fp)
