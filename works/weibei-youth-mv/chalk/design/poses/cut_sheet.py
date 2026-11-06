"""姿势原画分解图 → 每个姿势一张透明底粉笔图 + 元数据（json）。
用法：cut_sheet.py raw/A_hop_v1.png cut/A_hop [张数=4] ['[[x0,y0,x1,y1], …]' 要擦掉的矩形，原图像素坐标]
- 黑板底 → 透明；人物内部的黑线、缝隙 → 不透明的黑板色（挡住身后的粉笔线，和骨骼版部件同一做法）
- 颜色按原图的板色重映射到片子的板色 (15,28,21)
- 每个人物按从左到右编号 0..n-1，存 {prefix}_{i}.png；{prefix}.json 记录包围盒、脚底线、底部中点"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as nd

src, pre = sys.argv[1], sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 4
ERASE = json.loads(sys.argv[4]) if len(sys.argv) > 4 else []                   # 要擦掉的矩形 [[x0,y0,x1,y1],…]（豆包顺手画的粉笔线等）
BOARD = np.array([15., 28., 21.])

a = np.asarray(Image.open(src).convert('RGB')).astype(float)
H, W, _ = a.shape
# 去水印：只修补"豆包AI生成"那一小块字（x 1835–2030、y 1080–1137，按 2048×1152 换算），用周围的像素补；
# 以前整块右下角涂成板色，人物伸进那个角就被挖出一个方块缺口
import cv2
_wm = np.zeros((H, W), np.uint8); _wm[int(H * 0.9375):int(H * 0.987), int(W * 0.896):int(W * 0.992)] = 255
a = cv2.inpaint(a.clip(0, 255).astype(np.uint8), _wm, 7, cv2.INPAINT_TELEA).astype(float)
bg = np.median(a.reshape(-1, 3), 0)
big = nd.uniform_filter(a, size=(61, 61, 1))                                   # 局部板色（缓变）
loc = np.where(np.linalg.norm(big - bg, axis=2, keepdims=True) < 25, big, bg)
d = np.linalg.norm(a - loc, axis=2)
alpha = np.clip((d - 14) / 46, 0, 1)
for x0, y0, x1, y1 in ERASE: alpha[y0:y1, x0:x1] = 0

sil = nd.binary_closing(alpha > 0.15, iterations=5)                            # 细黑线、细缝合上
holes = nd.binary_fill_holes(sil) & ~sil                                       # 小洞填上（眼镜、瞳孔），大缝（胳膊和身子之间）留着
hl, hn = nd.label(holes)
if hn:
    hs = nd.sum(holes, hl, range(1, hn + 1))
    sil |= np.isin(hl, 1 + np.where(hs < 2500)[0])
lab, k = nd.label(nd.binary_dilation(sil, iterations=6))
sz = nd.sum(sil, lab, range(1, k + 1))
big_ids = [i + 1 for i in np.argsort(-sz) if sz[i] > 0.004 * H * W][:N]
figs = []
for i in big_ids:
    m = (lab == i) & sil
    ys, xs = np.where(m)
    figs.append((xs.mean(), m))
figs.sort(key=lambda f: f[0])
while len(figs) < N:                                                           # 两个人物连在一起：在最宽那块中段的列投影最低处竖着切开
    j = max(range(len(figs)), key=lambda q: np.ptp(np.where(figs[q][1].any(0))[0]))
    m = figs[j][1]; cols = np.where(m.any(0))[0]; c0, c1 = cols.min(), cols.max(); w = c1 - c0
    prof = m.sum(0).astype(float); lo, hi = int(c0 + 0.3 * w), int(c0 + 0.7 * w)
    cut = lo + int(np.argmin(prof[lo:hi])); L = m.copy(); L[:, cut:] = False; R = m.copy(); R[:, :cut] = False
    print('split figure', j, 'at x', cut)
    figs[j:j + 1] = [(np.where(L)[1].mean(), L), (np.where(R)[1].mean(), R)]
print(src, 'figures', len(figs), 'expected', N)

# 颜色：原图板色 → 片子板色；比板还暗的（黑线）→ 板色
rgb = BOARD + np.clip(a - loc, 0, None) * (255 - BOARD) / np.maximum(255 - loc, 1)
soft = nd.gaussian_filter(sil.astype(float), 1.0)
meta = []
for idx, (_, m) in enumerate(figs):
    A = np.where(m, np.maximum(alpha, nd.gaussian_filter(m.astype(float), 1.0)), 0)
    A = np.maximum(A, np.where(nd.binary_dilation(m, iterations=2), alpha, 0))
    ys, xs = np.where(A > 0.02)
    x0, y0, x1, y1 = max(0, xs.min() - 6), max(0, ys.min() - 6), min(W, xs.max() + 7), min(H, ys.max() + 7)
    out = np.dstack([rgb[y0:y1, x0:x1], A[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(f'{pre}_{idx}.png')
    solid = A > 0.5
    yb = np.where(solid.any(1))[0].max()                                      # 脚底线（最低的实心行）
    xb = np.where(solid[max(0, yb - 12):yb + 1].any(0))[0]
    meta.append(dict(i=idx, box=[int(x0), int(y0), int(x1), int(y1)], foot=[float(xb.mean() - x0), float(yb - y0)],
                     h=int(yb - np.where(solid.any(1))[0].min()), w=int(x1 - x0)))
json.dump(dict(src=src, H=H, W=W, figs=meta), open(f'{pre}.json', 'w'), indent=1)

# 预览：贴回片子的板色上，标出编号和脚底点
from PIL import ImageDraw
pv = Image.new('RGB', (W, H), tuple(int(v) for v in BOARD))
for f in meta:
    im = Image.open(f'{pre}_{f["i"]}.png'); pv.paste(im, (f['box'][0], f['box'][1]), im)
dr = ImageDraw.Draw(pv)
for f in meta:
    x0, y0, x1, y1 = f['box']; dr.rectangle([x0, y0, x1, y1], outline=(255, 200, 0), width=2)
    fx, fy = x0 + f['foot'][0], y0 + f['foot'][1]; dr.ellipse([fx - 8, fy - 8, fx + 8, fy + 8], outline=(255, 60, 60), width=3)
    dr.text((x0 + 6, y0 + 6), str(f['i']), fill=(255, 200, 0))
pv.resize((W // 2, H // 2)).save(f'{pre}_preview.jpg', quality=85)
for f in meta: print(f)
