"""按 rig2.json 切可弯曲网格版纸偶：parts2/<角色>/<网格>.png、头部表情贴图 head_e{眼}_m{嘴}.png、rig2_out.json。
眼：0 睁 / 1 半闭 / 2 闭（在原图眼白处盖一层毛色眼皮 + 睫毛线）；嘴：0 原图 / 1 大笑（少年，从表情稿第 3 张切来）。"""
import json, os, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from draw_arm import draw_arm
spec = json.load(open('rig2.json')); out = {}
def polymask(poly, H, W):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255); return np.asarray(m) > 0
def nearest_fill(rgb, hole, src):
    idx = nd.distance_transform_edt(~src, return_distances=False, return_indices=True)
    o = rgb.copy(); o[hole] = rgb[idx[0][hole], idx[1][hole]]; return o
R = np.random.default_rng(3)
def eyelids(rgb, alpha, boxes, f):
    o = rgb.copy(); lum = rgb.mean(2); sat = (rgb.max(2) - rgb.min(2)) / (rgb.max(2) + 1)
    for x0, y0, x1, y1 in boxes:
        sub = (slice(y0, y1), slice(x0, x1))
        white = (lum[sub] > 185) & (sat[sub] < 0.25)
        lab, k = nd.label(white); sz = nd.sum(white, lab, range(1, k + 1)); eye = lab == 1 + np.argmax(sz)
        ys_, xs_ = np.where(eye); cy, cx = (ys_.min() + ys_.max()) / 2, (xs_.min() + xs_.max()) / 2
        ry, rx = (ys_.max() - ys_.min()) / 2 + 2, (xs_.max() - xs_.min()) / 2 + 2
        gy, gx = np.mgrid[0:eye.shape[0], 0:eye.shape[1]]
        eye = ((gy - cy) / (ry + 4)) ** 2 + ((gx - cx) / (rx + 4)) ** 2 <= 1     # 整个眼睛（含瞳孔）按眼白外框的椭圆算
        fur = (~eye) & (lum[sub] > 90) & (sat[sub] > 0.3)
        lid = np.median(rgb[sub][fur], 0)
        cols = np.where(eye.any(0))[0]
        blk = o[sub]
        for c in cols:
            ys = np.where(eye[:, c])[0]; top, bot = ys.min(), ys.max(); h = bot - top + 1
            cut = top + int(round(f * h)) if f < 1 else bot + 1
            for y in ys:
                if y < cut: blk[y, c] = lid + R.normal(0, 5, 3)
            lash = cut if f < 1 else top + int(0.62 * h)
            for y in range(max(lash - 2, top), min(lash + 2, bot + 1)):
                if eye[y, c]: blk[y, c] = (58, 36, 26)
        o[sub] = blk
    return o
for ch, cfg in spec.items():
    im = np.asarray(Image.open(f'{ch}_cut.png')).astype(float); rgb, al = im[..., :3], im[..., 3] / 255
    H, W = al.shape; M = cfg['meshes']; polys = {k: polymask(v['poly'], H, W) for k, v in M.items()}
    os.makedirs(f'parts2/{ch}', exist_ok=True); out[ch] = {'height': cfg['height'], 'top': cfg['top'], 'bones': cfg['bones'], 'meshes': {}}
    for k, v in M.items():
        if v.get('draw'):   # 画出来的袖子
            sv = polymask(v['draw']['src'], H, W) & (al > 0.6)
            red = (rgb[..., 0] > 140) & (rgb[..., 1] < 95) & (rgb[..., 2] < 95)     # 书包带不要
            if ch == 'adult': sv &= ~(rgb.mean(2) > 185)      # 大人袖子没有浅色，浅色是纸边
            c, a = draw_arm(H, W, v['chain'], v['draw'], 7, rgb, sv & ~red)
            ys, xs = np.where(a > 0.02)
            x0, y0, x1, y1 = max(xs.min() - 4, 0), max(ys.min() - 4, 0), min(xs.max() + 5, W), min(ys.max() + 5, H)
            Image.fromarray(np.dstack([c, a * 255])[y0:y1, x0:x1].clip(0, 255).astype(np.uint8), 'RGBA').save(f'parts2/{ch}/{k}.png')
            meta = dict(v); meta.update(origin=[int(x0), int(y0)], size=[int(x1 - x0), int(y1 - y0)], file=f'parts2/{ch}/{k}.png'); out[ch]['meshes'][k] = meta
            continue
        m = polys[k].copy()
        for o_ in v.get('minus', []): m &= ~polys[o_]
        fillm = np.zeros((H, W), bool)
        for fp in v.get('fill', []): fillm |= polymask(fp, H, W)
        fillm &= polys[k]; m &= ~fillm
        a = al * m; c = rgb.copy()
        if fillm.any():
            srcm = a > 0.9
            if v.get('fill_src_red'):   # 远侧袖子后面露出的是书包：只用书包红色补
                srcm &= (rgb[..., 0] > 140) & (rgb[..., 1] < 95)
            c = nearest_fill(rgb, fillm, srcm); a = np.maximum(a, fillm * (al > 0.5))
        ys, xs = np.where(a > 0.02)
        x0, y0, x1, y1 = max(xs.min() - 4, 0), max(ys.min() - 4, 0), min(xs.max() + 5, W), min(ys.max() + 5, H)
        def save(name, cc):
            Image.fromarray(np.dstack([cc, a * 255])[y0:y1, x0:x1].clip(0, 255).astype(np.uint8), 'RGBA').save(f'parts2/{ch}/{name}.png')
        meta = dict(v); meta.update(origin=[int(x0), int(y0)], size=[int(x1 - x0), int(y1 - y0)])
        if k == 'head':
            mouths = [c]
            if 'mouth' in v:   # 少年：大笑嘴型
                ex0, ey0, ex1, ey1 = v['mouth']['erase']; lum = c.mean(2)
                er = np.zeros((H, W), bool); er[ey0:ey1, ex0:ex1] = lum[ey0:ey1, ex0:ex1] < 150
                er = nd.binary_dilation(er, iterations=2)
                base = nearest_fill(c, er, ~er & (a > 0.9))
                sheet = Image.open('../design/sheets/kid_expr.png').convert('RGB').crop((835, 628, 945, 722))
                sc = 1.5; sheet = sheet.resize((int(sheet.width * sc), int(sheet.height * sc)), Image.LANCZOS)
                sp = np.asarray(sheet).astype(float); sl = sp.mean(2); ss = (sp.max(2) - sp.min(2)) / (sp.max(2) + 1)
                mm = nd.binary_dilation((ss > 0.28) | (sl < 140), iterations=2); lab, kk = nd.label(mm)
                szs = nd.sum(mm, lab, range(1, kk + 1)); mm = lab == 1 + np.argmax(szs)
                mm = nd.gaussian_filter(nd.binary_dilation(mm, iterations=1).astype(float), 1.2)
                ax, ay = v['mouth']['at']; px, py = ax - sp.shape[1] // 2 + 2, ay - sp.shape[0] // 2 + 10
                laugh = base.copy(); reg = laugh[py:py + sp.shape[0], px:px + sp.shape[1]]
                laugh[py:py + sp.shape[0], px:px + sp.shape[1]] = reg * (1 - mm[..., None]) + sp * mm[..., None]
                mouths.append(laugh)
            files = {}
            for mi, mc in enumerate(mouths):
                for e, f in enumerate([0, 0.55, 1]):
                    cc = mc if e == 0 else eyelids(mc, al, v['eyes'], f)
                    save(f'head_e{e}_m{mi}', cc); files[f'e{e}_m{mi}'] = f'parts2/{ch}/head_e{e}_m{mi}.png'
            meta['files'] = files; meta['file'] = files['e0_m0']
        else:
            save(k, c); meta['file'] = f'parts2/{ch}/{k}.png'
        if k.startswith('leg'):
            rows = np.where((a > 0.5).sum(1) > 5)[0]; meta['sole'] = int(rows.max())
        out[ch]['meshes'][k] = meta
json.dump(out, open('rig2_out.json', 'w'), ensure_ascii=False, indent=1)
print({c: {k: v.get('sole') for k, v in o['meshes'].items() if 'sole' in v} for c, o in out.items()})
