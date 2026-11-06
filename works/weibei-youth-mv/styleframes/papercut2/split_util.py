"""拆层公共函数（split_<场景>.py 共用）。做法同 split_shed.py：
每层给一个"本层像素"掩码 M_i（从远到近），被更近层挡住的地方用本层最近像素补色、alpha 向外延 EXT 像素
（只延到被更近层盖住的区域，视差时不露缝）；L0 不透明，非 L0 区域用最近像素补后柔化；左右 edge 补 PAD。"""
import json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

PAD = 60
EXT = 80   # 被遮挡区域向外延的像素（≥ 镜头横移 ±30px 带来的层间错位）
ROOT = os.path.dirname(os.path.abspath(__file__))


def load(fname):
    return np.asarray(Image.open(f'{ROOT}/../../design/scenes_final/{fname}').convert('RGB')).astype(float)


def poly(shape, *polys):
    H, W = shape[:2]
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for ps in polys: d.polygon(ps, fill=255)
    return np.asarray(m) > 0


def nearest_fill(rgb, keep):
    """keep 以外的像素换成最近的 keep 像素。"""
    idx = nd.distance_transform_edt(~keep, return_distances=False, return_indices=True)
    return rgb[idx[0], idx[1]]


def erase(a, box, size=31, t=40, grow=3, bright=None, blur=2.0, flat=False, pct=None):
    """去字：box 内与局部中值（size=None 时用整框中值色）色差 > t 的像素视为"墨"，膨胀 grow 后用最近非墨像素补、轻微柔化。
    bright=True 只抓比底亮的（白字水印），False 只抓暗的，None 都抓。原地修改 a，返回墨掩码。"""
    x0, y0, x1, y1 = box
    c = a[y0:y1, x0:x1]
    if pct is not None:   # 底色取框内最亮的 (100-pct)% 像素的均值（浅色纸上的深色字）
        l = c.mean(2); bg = c[l >= np.percentile(l, pct)].mean(0)[None, None, :] * np.ones_like(c)
    elif size is None:
        bg = np.median(c.reshape(-1, 3), 0)[None, None, :] * np.ones_like(c)
    else:
        bg = np.stack([nd.median_filter(c[..., k], size=size) for k in range(3)], -1)
    diff = c - bg
    dist = np.sqrt((diff ** 2).sum(-1))
    ink = dist > t
    if bright is True: ink &= diff.mean(-1) > 0
    if bright is False: ink &= diff.mean(-1) < 0
    ink = nd.binary_dilation(ink, iterations=grow)
    if not ink.any(): return ink
    f = bg if flat else nearest_fill(c, ~ink)   # flat=True：墨直接换成底色（中值），适合浅色纸上的密集字
    f = np.where(ink[..., None], nd.gaussian_filter(f, (blur, blur, 0)), c)
    a[y0:y1, x0:x1] = f
    return ink


def erase_watermark(a):
    """右下角"豆包 AI 生成"，5 张图位置相同。"""
    erase(a, (1828, 1078, 2040, 1145), size=41, t=28, grow=3)


def _run_dist(m, axis, both):
    """沿 axis 到最近 m 像素的距离；both=False 时只看"前方"（axis 方向上之前的像素，即左/上）。"""
    n = m.shape[axis]
    ar = np.arange(n).reshape([-1 if k == axis else 1 for k in range(2)]) * np.ones(m.shape)
    prev = np.maximum.accumulate(np.where(m, ar, -1e9), axis=axis)
    d = ar - prev
    if both:
        nxt = np.flip(np.minimum.accumulate(np.flip(np.where(m, ar, 1e9), axis), axis=axis), axis)
        d = np.minimum(d, nxt - ar)
    return d


def extend_zone(m):
    """被遮挡区里本层可以"延续"的地方：同一行左右 EXT 内有本层像素（横移露出的竖条），或同一列上方 EXT 内有本层像素（楼向下延到前景后面）。
    不做任意方向膨胀，免得在细杆子后面长出不该有的本层碎片。"""
    return (_run_dist(m, 1, True) <= EXT) | (_run_dist(m, 0, False) <= EXT)


def build(name, a, masks, depth, floor_y, floor_kind, notes):
    """masks: L1..Ln 的本层掩码（从远到近）；L0 = 其余全部。"""
    H, W, _ = a.shape
    out = f'{ROOT}/layers/{name}'; os.makedirs(out, exist_ok=True)
    # 每层只保留不被更近层占用的部分
    masks = [m.copy() for m in masks]
    for i in range(len(masks)):
        for j in range(i + 1, len(masks)): masks[i] &= ~masks[j]
    covered = [np.zeros((H, W), bool) for _ in masks]   # 被更近层盖住的区域
    for i in range(len(masks)):
        for j in range(i + 1, len(masks)): covered[i] |= masks[j]
    rgbs, alphas = [], []
    # L0：所有前景区域用最近的 L0 像素补，再柔化
    fg = np.zeros((H, W), bool)
    for m in masks: fg |= m
    hole = nd.binary_dilation(fg, iterations=3)
    sky = nearest_fill(a, ~hole)
    sky = np.where(hole[..., None], nd.gaussian_filter(sky, (6, 6, 0)), a)
    rgbs.append(sky); alphas.append(np.ones((H, W)))
    for i, m in enumerate(masks):
        rgb = np.where(m[..., None], a, nearest_fill(a, m))
        al = m | (extend_zone(m) & covered[i]) | (nd.binary_dilation(m, iterations=2) & covered[i])
        rgbs.append(rgb); alphas.append(nd.gaussian_filter(al.astype(float), 0.7))
    files = []
    for i, (rgb, al) in enumerate(zip(rgbs, alphas)):
        if i == 0: al = np.ones((H, W))
        rgba = np.dstack([rgb, al * 255]).clip(0, 255).astype(np.uint8)
        rgba = np.pad(rgba, ((0, 0), (PAD, PAD), (0, 0)), mode='edge')
        Image.fromarray(rgba, 'RGBA').save(f'{out}/L{i}.png'); files.append(f'L{i}.png')
        print(name, f'L{i}', rgba.shape)
    json.dump({'layers': [{'file': f, 'depth_hint': d} for f, d in zip(files, depth)],
               'floor_y': floor_y, 'floor_kind': floor_kind, 'pad': PAD, 'ref_size': [W, H], 'notes': notes},
              open(f'{out}/meta.json', 'w'), ensure_ascii=False, indent=1)
    check(out, len(files), floor_y)


def check(out, n, floor_y):
    """各层叠绿底 + 全部合成 + 合成画 floor_y 线 + 原图 + 差异图。"""
    tiles = []
    comp = None
    for i in range(n):
        L = Image.open(f'{out}/L{i}.png')
        g = Image.new('RGBA', L.size, (30, 160, 60, 255)); g.alpha_composite(L); tiles.append(g.convert('RGB'))
        comp = L.copy() if comp is None else (comp.alpha_composite(L) or comp)
    comp = comp.convert('RGB'); tiles.append(comp)
    fl = comp.copy(); ImageDraw.Draw(fl).line((0, floor_y, fl.width, floor_y), fill=(0, 255, 255), width=3); tiles.append(fl)
    cols = 2; rows = (len(tiles) + 1) // 2
    w, h = tiles[0].width // 2, tiles[0].height // 2
    sheet = Image.new('RGB', (cols * w + 10, rows * h + 10 * (rows - 1)), 'white')
    for k, t in enumerate(tiles):
        sheet.paste(t.resize((w, h)), ((k % 2) * (w + 10), (k // 2) * (h + 10)))
    sheet.save(f'{out}/check.jpg', quality=85)


def diff_report(name, fname):
    """合成 vs 原图：打印平均/99 分位色差，返回 (合成, 原图, 差值)。"""
    out = f'{ROOT}/layers/{name}'
    comp = None
    for f in sorted(x for x in os.listdir(out) if x.startswith('L') and x.endswith('.png')):
        L = Image.open(f'{out}/{f}')
        comp = L.copy() if comp is None else (comp.alpha_composite(L) or comp)
    c = np.asarray(comp.convert('RGB')).astype(float)[:, PAD:-PAD]
    o = load(fname)
    d = np.abs(c - o).mean(2)
    print(name, 'mean diff %.2f  p99 %.1f  pixels>30: %d' % (d.mean(), np.percentile(d, 99), (d > 30).sum()))
    return c, o, d


def patch(a, box, feather=3):
    """整块抹平：框内每列按框上、下沿外侧的颜色竖向线性插值（适合整行小字），边缘柔化 feather 像素。原地修改 a。"""
    x0, y0, x1, y1 = box
    top = a[y0 - 3:y0, x0:x1].mean(0); bot = a[y1:y1 + 3, x0:x1].mean(0)
    t = np.linspace(0, 1, y1 - y0)[:, None, None]
    fill = nd.gaussian_filter(top[None] * (1 - t) + bot[None] * t, (0, 2, 0))
    w = np.ones((y1 - y0, x1 - x0))
    w = nd.gaussian_filter(np.pad(w, feather), feather / 1.5)[feather:-feather, feather:-feather][..., None]
    a[y0:y1, x0:x1] = fill * w + a[y0:y1, x0:x1] * (1 - w)
