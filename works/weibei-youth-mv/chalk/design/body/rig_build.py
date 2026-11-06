"""全身设定图 → 骨骼动画部件（system python3：要 cv2 / skimage）。
用法：python3 rig_build.py [kid|adult ...] [--seg]   （--seg 只出分割检查图）
步骤：
1 抠图 + 粉笔化：alpha = 和黑板色的色差；近黑勾线 → 不透明的黑板色（部件叠在一起时轮廓还在）
2 分割：沿手标的骨头撒种子，按勾线（低 alpha）做分水岭，切出 头/躯干/骨盆/手臂/手/腿/鞋/尾巴
3 输出：四肢、尾巴沿中线拉直成长条（u = 弧长，v = 法向）；躯干、骨盆、手、鞋裁成小图；躯干被近侧手臂挡住的地方补画
坐标都是原图像素。输出到 ../rig/：{who}_{part}.png + {who}_rig.json"""
import json, os, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as nd
from skimage.segmentation import watershed

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', 'rig'); os.makedirs(OUT, exist_ok=True)
BOARD = np.array([15, 28, 21], float)
DEF = {
  'kid': dict(src='kid_body_ref.png', ground=1027,
    neck=(1010, 482), hip=(990, 752), head=(1000, 300),
    shN=(893, 520), elN=(878, 612), wrN=(862, 703), pawN=(835, 745),
    shF=(1112, 520), elF=(1140, 615), wrF=(1172, 706), pawF=(1195, 745),
    hpN=(960, 768), knN=(958, 870), anN=(958, 970), shoeN=(947, 1000),
    hpF=(1085, 768), knF=(1090, 868), anF=(1092, 960), shoeF=(1125, 993),
    tail=[(925, 762), (870, 812), (800, 848), (725, 840), (662, 806)], pack=[(845, 540), (850, 690)],
    tseed=[[(935, 560), (925, 690)], [(965, 700), (1010, 735)], [(1060, 720), (1120, 720)]], hw=dict(arm=46, leg=54, legF=50, tail=70),
    shoeboxN=(890, 976, 1003, 1035), shoeboxF=(1050, 966, 1200, 1030)),
  'adult': dict(src='adult_body_ref.png', ground=1052,
    neck=(1030, 415), hip=(1012, 705), head=(1010, 270),
    shN=(930, 472), elN=(902, 575), wrN=(868, 668), pawN=(835, 718),
    shF=(1100, 468), elF=(1137, 588), wrF=(1165, 676), pawF=(1192, 715),
    hpN=(971, 718), knN=(968, 860), anN=(958, 1000), shoeN=(928, 1032),
    hpF=(1060, 718), knF=(1060, 858), anF=(1062, 995), shoeF=(1085, 1020),
    tail=[(922, 745), (880, 805), (820, 855), (750, 880), (700, 878)], pack=None,
    tseed=[[(955, 515), (942, 690)], [(1005, 432), (1060, 432)]], hw=dict(arm=42, leg=46, legF=40, tail=62),
    shoeboxN=(872, 1004, 985, 1068), shoeboxF=(1024, 998, 1146, 1046)),
}
PARTS = ['head', 'torso', 'pelvis', 'armN', 'pawN', 'armF', 'pawF', 'legN', 'shoeN', 'legF', 'shoeF', 'tail']
ID = {p: i + 1 for i, p in enumerate(PARTS)}


def keyed(src):
  a = np.asarray(Image.open(os.path.join(HERE, src)).convert('RGB')).astype(float); H, W, _ = a.shape
  a[int(H * 0.9):, int(W * 0.75):] = np.median(a.reshape(-1, 3), 0)
  bg = np.median(a.reshape(-1, 3), 0); big = nd.uniform_filter(a, size=(61, 61, 1))
  d = np.linalg.norm(a - np.where(np.linalg.norm(big - bg, axis=2, keepdims=True) < 25, big, bg), axis=2)
  alpha = np.clip((d - 14) / 46, 0, 1)
  m = nd.binary_closing(alpha > 0.15, iterations=6); m = nd.binary_fill_holes(m)
  lab, k = nd.label(nd.binary_dilation(m, iterations=10)); sz = nd.sum(m, lab, range(1, k + 1))
  sil = (lab == (np.argmax(sz) + 1)) & m
  lum = a.mean(2); sat = (a.max(2) - a.min(2)) / (a.max(2) + 1)
  darkN = np.clip((95 - lum) / 45, 0, 1) * np.clip((0.35 - sat) / 0.2, 0, 1)           # 近黑勾线 → 黑板色
  darkC = np.clip((80 - lum) / 50, 0, 1) * (1 - np.clip((0.35 - sat) / 0.2, 0, 1))
  rgb = a * 0.92 + 255 * 0.06
  rgb = rgb * (1 - darkN[..., None]) + BOARD * darkN[..., None]
  rgb = rgb * (1 - 0.45 * darkC[..., None]) + BOARD * 0.45 * darkC[..., None]
  inner = nd.binary_erosion(sil, iterations=3)
  al = np.where(inner, np.maximum(alpha, darkN), alpha) * sil                          # 里面的勾线不透明（叠在别的部件上还看得见）
  return rgb, al, sil


def polyline(img, pts, val, w):
  for p, q in zip(pts[:-1], pts[1:]): cv2.line(img, tuple(map(int, p)), tuple(map(int, q)), int(val), int(w))


def lerp2(p, q, t): return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)


def band(shape, pts, r):
  m = np.zeros(shape, np.uint8); polyline(m, pts, 1, 1); return nd.distance_transform_edt(m == 0) <= r


def segment(D, al, sil):
  H, W = al.shape; mk = np.zeros((H, W), np.int32); g = lambda k: D[k]
  cv2.circle(mk, tuple(map(int, g('head'))), 50, ID['head'], -1); polyline(mk, [g('head'), (g('neck')[0] - 10, g('neck')[1] - 40)], ID['head'], 9)
  sp = [(g('hip')[0], g('hip')[1] - 20), (g('neck')[0] - 8, g('neck')[1] + 22)]
  polyline(mk, sp, ID['torso'], 7)
  mid = lerp2(sp[0], sp[1], 0.8)
  polyline(mk, [mid, lerp2(mid, g('shN'), 0.65)], ID['torso'], 5); polyline(mk, [mid, lerp2(mid, g('shF'), 0.65)], ID['torso'], 5)
  if D.get('pack'): polyline(mk, D['pack'], ID['torso'], 7)
  for ln in D.get('tseed', []): polyline(mk, ln, ID['torso'], 5)
  for s in 'NF':
    polyline(mk, [lerp2(g('sh' + s), g('el' + s), 0.2), g('el' + s), lerp2(g('el' + s), g('wr' + s), 0.85)], ID['arm' + s], 5)
    polyline(mk, [lerp2(g('wr' + s), g('paw' + s), 0.35), g('paw' + s)], ID['paw' + s], 5)
    polyline(mk, [lerp2(g('hp' + s), g('kn' + s), 0.05), g('kn' + s), lerp2(g('kn' + s), g('an' + s), 0.85)], ID['leg' + s], 7)
    cv2.circle(mk, tuple(map(int, g('shoe' + s))), 10, ID['shoe' + s], -1)
  polyline(mk, D['tail'][1:], ID['tail'], 9)
  mk[~(al > 0.3)] = 0
  elev = (255 * (1 - nd.gaussian_filter(al, 1.0))).astype(np.uint8)
  lab = watershed(elev, mk, mask=nd.binary_dilation(sil, iterations=2))
  # 四肢只认中线附近一条带子里的：带子外面被分给手臂的（夹克前襟、书包带）还给躯干
  hw = D['hw']
  for s in 'NF':
    # 带子外面的：靠躯干那一侧（内侧）的是夹克前襟、书包带 → 躯干；外侧的是袖子边上的笔触 → 还是手臂
    pts = [g('sh' + s), g('el' + s), g('wr' + s)]
    out = (lab == ID['arm' + s]) & ~band(lab.shape, pts, hw['arm'] + 6); ys, xs = np.where(out)
    if len(ys):
      P = np.array(pts, float); best = np.full(len(ys), 1e9); side = np.zeros(len(ys))
      for a, b in zip(P[:-1], P[1:]):
        d = b - a; L2 = (d ** 2).sum(); t = np.clip(((xs - a[0]) * d[0] + (ys - a[1]) * d[1]) / L2, 0, 1)
        qx, qy = a[0] + t * d[0], a[1] + t * d[1]; dist = np.hypot(xs - qx, ys - qy); cr = d[0] * (ys - a[1]) - d[1] * (xs - a[0])
        m = dist < best; best[m] = dist[m]; side[m] = cr[m]
      hx = g('hip')[0]; inner = (np.sign(xs - np.array([p[0] for p in pts]).mean()) == np.sign(hx - np.array([p[0] for p in pts]).mean()))
      lab[ys[inner], xs[inner]] = ID['torso']
  # 腿：髋关节上方 25px 以上的（夹克下摆）还给躯干；鞋框里、裤脚以下的归鞋
  yy, xx = np.mgrid[0:H, 0:W]
  for s in 'NF':
    L = lab == ID['leg' + s]; lab[L & (yy < g('hp' + s)[1] - 25)] = ID['torso']
    x0, y0, x1, y1 = D['shoebox' + s]; lab[((lab == ID['leg' + s]) | (lab == ID['shoe' + s])) & (xx >= x0) & (xx <= x1) & (yy >= y0)] = ID['shoe' + s]
    lab[(lab == ID['shoe' + s]) & ~((xx >= x0 - 4) & (xx <= x1 + 4) & (yy >= y0 - 4) & (yy <= y1 + 4))] = 0
  # 腿带子外面的：在尾巴带子里归尾巴，否则归躯干；手只留腕到指尖附近；尾巴只留带子里
  tb = band(lab.shape, D['tail'], hw['tail'] + 10)
  for s in 'NF':
    out = (lab == ID['leg' + s]) & ~band(lab.shape, [g('hp' + s), g('kn' + s), g('an' + s)], hw['leg' + ('F' if s == 'F' else '')] + 6)
    lab[out & tb] = ID['tail']; lab[out & ~tb] = ID['torso']
    lab[(lab == ID['paw' + s]) & ~band(lab.shape, [g('wr' + s), g('paw' + s)], hw['arm'] + 22)] = 0
  lab[(lab == ID['tail']) & ~tb] = 0
  lab[(lab == ID['torso']) & (yy > g('hip')[1] + 45)] = 0          # 躯干只到腰下一点（两腿之间的零碎不要）
  lab[al < 0.02] = 0
  return lab


def seg_preview(who, rgb, al, lab, D):
  cols = np.array([[0, 0, 0], [200, 60, 60], [60, 160, 230], [230, 200, 60], [60, 220, 120], [240, 120, 220], [40, 120, 60], [160, 90, 230], [250, 160, 60], [120, 240, 240], [140, 70, 30], [90, 90, 200], [240, 240, 240]], np.uint8)
  base = (rgb * al[..., None] + BOARD * (1 - al[..., None])).clip(0, 255).astype(np.uint8)
  ov = (0.45 * base + 0.55 * cols[lab]).astype(np.uint8); ov[lab == 0] = base[lab == 0]
  for k in ['neck', 'hip', 'shN', 'elN', 'wrN', 'shF', 'elF', 'wrF', 'hpN', 'knN', 'anN', 'hpF', 'knF', 'anF']:
    cv2.circle(ov, tuple(map(int, D[k])), 5, (255, 255, 0), -1)
  ys, xs = np.where(lab > 0); crop = ov[ys.min() - 10:ys.max() + 10, xs.min() - 10:xs.max() + 10]
  Image.fromarray(crop).save(os.path.join(OUT, f'{who}_seg.jpg'), quality=88); print('seg preview', crop.shape)


def strip(rgb, al, mask, pts, hw, e0=0, e1=0, fade=12):
  """沿中线 pts（关节点）拉直：返回 RGBA 长条 + 各关节的 u。靠身体那一端（肩、髋、尾根）淡入，盖在躯干上不露直切口，也不带出别处的碎片。"""
  P = np.array(pts, float); seg = P[1:] - P[:-1]; L = np.linalg.norm(seg, axis=1); cum = np.concatenate([[0], np.cumsum(L)])
  tot = cum[-1]; us = np.arange(-e0, tot + e1 + 1, 1.0)
  # 中线（端点外延）+ 平滑过的法向
  def at(u):
    i = np.clip(np.searchsorted(cum, u, side='right') - 1, 0, len(L) - 1); f = (u - cum[i]) / L[i]
    return P[i] + seg[i] * f[:, None], seg[i] / L[i][:, None]
  C, T = at(us); k = int(hw * 0.8) * 2 + 1
  T = np.stack([nd.uniform_filter1d(T[:, 0], k, mode='nearest'), nd.uniform_filter1d(T[:, 1], k, mode='nearest')], 1); T /= np.linalg.norm(T, axis=1, keepdims=True)
  N = np.stack([-T[:, 1], T[:, 0]], 1); vs = np.arange(-hw, hw + 1, 1.0)
  X = C[None, :, 0] + vs[:, None] * N[None, :, 0]; Y = C[None, :, 1] + vs[:, None] * N[None, :, 1]
  m = nd.map_coordinates(mask.astype(float), [Y, X], order=1, cval=0) > 0.5
  out = np.zeros(X.shape + (4,))
  for c in range(3): out[..., c] = nd.map_coordinates(rgb[..., c], [Y, X], order=1, cval=0)
  out[..., 3] = nd.map_coordinates(al, [Y, X], order=1, cval=0) * m
  out[..., 3] *= np.clip((us + 2) / fade, 0, 1)[None, :]
  return out, [float(e0 + c) for c in cum]


def sprite(rgb, al, mask, pad=4):
  ys, xs = np.where(mask); y0, y1, x0, x1 = ys.min() - pad, ys.max() + pad + 1, xs.min() - pad, xs.max() + pad + 1
  o = np.dstack([rgb, al * mask])[y0:y1, x0:x1]; return o, (int(x0), int(y0))


def save(arr, name):
  Image.fromarray(arr.clip(0, 255).astype(np.uint8) if arr.max() > 1.5 else (arr * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, name))


def build(who, seg_only=False):
  D = DEF[who]; rgb, al, sil = keyed(D['src']); lab = segment(D, al, sil); seg_preview(who, rgb, al, lab, D)
  if seg_only: return
  M = {p: nd.binary_dilation(lab == ID[p], iterations=2) & sil for p in PARTS}
  rgba = lambda a: np.dstack([a[..., :3], a[..., 3:] * 255]) if a.shape[-1] == 4 else a
  meta = {'ground': D['ground'], 'pts': {k: D[k] for k in D if k not in ('src', 'ground', 'pack', 'tseed', 'hw', 'shoeboxN', 'shoeboxF')}, 'parts': {}}
  # 躯干：近侧手臂挡住的部分（离躯干 40px 以内）补画
  tor = (lab == ID['torso']); hole = (lab == ID['armN']) & nd.binary_dilation(tor, iterations=40 if who == 'kid' else 16) & (np.arange(al.shape[0])[:, None] < D['hip'][1] + 5)
  tm = (tor | hole); img8 = (rgb * al[..., None] + BOARD * (1 - al[..., None])).clip(0, 255).astype(np.uint8)
  fill = cv2.inpaint(cv2.cvtColor(img8, cv2.COLOR_RGB2BGR), hole.astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
  fill = cv2.cvtColor(fill, cv2.COLOR_BGR2RGB).astype(float)
  noise = np.random.default_rng(7).normal(0, 9, fill.shape); rgbT = np.where(hole[..., None], fill + noise, rgb); alT = np.where(hole, 1.0, al)
  yy = np.arange(al.shape[0])[:, None]
  pel = (M['legN'] | M['legF']) & (yy < D['hip'][1] + 60)
  own = (lab == 0) | (lab == ID['torso']) | hole                                      # 外扩 2px 只往空白和自己身上扩，不带走手臂边缘的笔触
  for p, (src_rgb, src_al, mm) in {'torso': (rgbT, alT, nd.binary_dilation(tm, iterations=2) & (sil | hole) & own), 'pelvis': (rgb, al, pel)}.items():
    o, off = sprite(src_rgb, src_al, mm); save(np.dstack([o[..., :3], o[..., 3] * 255]), f'{who}_{p}.png'); meta['parts'][p] = {'img': f'{who}_{p}.png', 'off': off}
  for p in ['pawN', 'pawF', 'shoeN', 'shoeF']:
    o, off = sprite(rgb, al, M[p]); save(np.dstack([o[..., :3], o[..., 3] * 255]), f'{who}_{p}.png'); meta['parts'][p] = {'img': f'{who}_{p}.png', 'off': off}
  for s in 'NF':
    for kind, pts, hw in [('arm', [D['sh' + s], D['el' + s], D['wr' + s]], D['hw']['arm']), ('leg', [D['hp' + s], D['kn' + s], D['an' + s]], D['hw']['leg' + ('F' if s == 'F' else '')])]:
      mm = M[kind + s]; o, us = strip(rgb, al, mm, pts, hw, e0=10, e1=6, fade=16 if kind == 'arm' else 10)
      save(np.dstack([o[..., :3], o[..., 3] * 255]), f'{who}_{kind}{s}.png'); meta['parts'][kind + s] = {'img': f'{who}_{kind}{s}.png', 'u': us, 'hw': hw}
  o, us = strip(rgb, al, M['tail'], D['tail'], D['hw']['tail'], e0=14, e1=10, fade=12)
  save(np.dstack([o[..., :3], o[..., 3] * 255]), f'{who}_tail.png'); meta['parts']['tail'] = {'img': f'{who}_tail.png', 'u': us, 'hw': D['hw']['tail']}
  json.dump(meta, open(os.path.join(OUT, f'{who}_rig.json'), 'w'), indent=1); print(who, 'ok', list(meta['parts']))


if __name__ == '__main__':
  whos = [a for a in sys.argv[1:] if not a.startswith('--')] or ['kid', 'adult']
  for w in whos: build(w, '--seg' in sys.argv)
