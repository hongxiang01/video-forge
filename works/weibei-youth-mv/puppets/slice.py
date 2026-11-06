"""按 rig.json 把抠好的角色切成纸偶零件：parts/<角色>/<零件>.png + rig_out.json（零件左上角、关节点、父子、层序）。"""
import json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
spec = json.load(open('rig.json')); out = {}
def polymask(poly, shape):
    m = Image.new('L', (shape[1], shape[0]), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
    return np.asarray(m) > 0
for ch, cfg in spec.items():
    im = np.asarray(Image.open(f'{ch}_cut.png')).astype(float)
    rgb, al = im[..., :3], im[..., 3] / 255
    H, W = al.shape; P = cfg['parts']; polys = {k: polymask(v['poly'], (H, W)) for k, v in P.items()}
    import os; os.makedirs(f'parts/{ch}', exist_ok=True); out[ch] = {}
    for k, v in P.items():
        m = polys[k].copy()
        for o in v.get('minus', []): m &= ~polys[o]
        if v.get('fill'):
            for fp in v['fill']: m &= ~polymask(fp, (H, W))
        a = al * m; c = rgb.copy()
        if v.get('fill'):  # 手臂挪开后露出的身子：用最近的身子像素颜色补，阿尔法补满
            fillm = np.zeros((H, W), bool)
            for fp in v['fill']: fillm |= polymask(fp, (H, W))
            fillm &= polys[k]
            src = (a > 0.9)
            idx = nd.distance_transform_edt(~src, return_distances=False, return_indices=True)
            c[fillm] = rgb[idx[0][fillm], idx[1][fillm]]
            a = np.maximum(a, fillm * (al > 0.5)); c = np.where(fillm[..., None], c, rgb)
        ys, xs = np.where(a > 0.02)
        x0, y0, x1, y1 = max(xs.min() - 4, 0), max(ys.min() - 4, 0), min(xs.max() + 5, W), min(ys.max() + 5, H)
        rgba = np.dstack([c, a * 255])[y0:y1, x0:x1].clip(0, 255).astype(np.uint8)
        Image.fromarray(rgba, 'RGBA').save(f'parts/{ch}/{k}.png')
        out[ch][k] = {'file': f'parts/{ch}/{k}.png', 'origin': [int(x0), int(y0)], 'size': [int(x1 - x0), int(y1 - y0)],
                      'pivot': v['pivot'], 'parent': v['parent'], 'z': v['z']}
    # 检查图：零件按层序叠回去，应和原图一致
    can = Image.new('RGBA', (W, H), (40, 60, 90, 255))
    for k in sorted(P, key=lambda k: P[k]['z']):
        p = Image.open(f'parts/{ch}/{k}.png'); can.alpha_composite(p, tuple(out[ch][k]['origin']))
    can.convert('RGB').save(f'{ch}_reassembled.jpg')
json.dump(out, open('rig_out.json', 'w'), ensure_ascii=False, indent=1)
print('ok', {k: len(v) for k, v in out.items()})
