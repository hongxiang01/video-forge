"""车棚参考图拆层：sky / town / shed（RGBA，左右补 PAD 像素供视差）。楼是方块，用多边形框；地面在 three.js 里重画。"""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
PAD = 60
a = np.asarray(Image.open('../../design/scenes_final/1_shed.png').convert('RGB')).astype(float)
H, W, _ = a.shape; lum = a.mean(2)
yy = np.arange(H)[:, None] * np.ones((1, W))
def poly(ps):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(ps, fill=255); return np.asarray(m) > 0
ROOF = 492   # 顶棚上沿（楼的下沿压在顶棚后面）
bld = poly([(0, 298), (214, 298), (214, 345), (592, 345), (592, ROOF), (0, ROOF)]) \
    | poly([(567, 239), (1599, 214), (1599, ROOF), (567, ROOF)]) \
    | poly([(1578, 332), (1640, 292), (2048, 284), (2048, ROOF), (1578, ROOF)])
poles = poly([(306, 128), (348, 128), (348, ROOF), (306, ROOF)]) | poly([(280, 150), (390, 150), (390, 172), (280, 172)]) \
    | poly([(292, 258), (365, 258), (365, 272), (292, 272)]) \
    | poly([(1718, 113), (1748, 113), (1748, 300), (1718, 300)]) | poly([(1690, 130), (1780, 130), (1780, 150), (1690, 150)])
wires = (lum < 95) & (yy > 120) & (yy < 330) & ~bld
wires = nd.binary_opening(wires, structure=np.ones((1, 9)))            # 只留横向细线
town = bld | poles | nd.binary_dilation(wires, iterations=1)
def save(name, rgb, alpha):
    rgba = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
    rgba = np.pad(rgba, ((0, 0), (PAD, PAD), (0, 0)), mode='edge')
    Image.fromarray(rgba, 'RGBA').save(f'layers/{name}.png'); print(name, rgba.shape)
# 天空：楼、杆、线的位置用最近的天空像素补，再柔化
hole = nd.binary_dilation(town, iterations=3) | (yy >= ROOF)
idx = nd.distance_transform_edt(hole, return_distances=False, return_indices=True)
sky = a[idx[0], idx[1]]; sky = np.where(hole[..., None], nd.gaussian_filter(sky, (5, 5, 0)), sky)
save('sky', sky, np.ones((H, W)))
# 楼：向下多延 80px（藏在顶棚后，视差时不露缝）
ext = (yy >= ROOF) & (yy < ROOF + 80)
idx2 = nd.distance_transform_edt(~(bld & (yy < ROOF)), return_distances=False, return_indices=True)
t_rgb = np.where(ext[..., None], a[idx2[0], idx2[1]], a)
t_al = nd.gaussian_filter((town | (ext & nd.binary_dilation(bld, iterations=90))).astype(float), 0.6)
save('town', t_rgb, t_al)
# 车棚：顶棚上沿到地台下沿
ry = np.where(np.arange(W) < 1300, 486, 478)[None, :]
save('shed', a, nd.gaussian_filter(((yy >= ry) & (yy < 962)).astype(float), 0.7))
