"""从车棚定稿图切一辆二八车做道具：车架（原图剪影，去掉两个轮子）+ 程序画的轮子、曲柄（会转）。坐标为原图像素。"""
import json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
X0, Y0, X1, Y1 = 700, 688, 1112, 942
FW, RW, CR, R = (783, 875), (1035, 875), (925, 860), 79
im = np.asarray(Image.open('design/scenes_final/1_shed.png').convert('RGB')).astype(float)[Y0:Y1, X0:X1]
H, W = im.shape[:2]; yy, xx = np.mgrid[0:H, 0:W] + np.array([Y0, X0])[:, None, None]
dark = im.mean(2) < 95
far = lambda c, r: np.hypot(xx - c[0], yy - c[1]) > r
frame = dark & far(FW, R) & far(RW, R) & far(CR, 36) & far((930, 912), 20) & (xx > 716)
frame = nd.binary_opening(frame, iterations=1)
img = Image.fromarray(np.dstack([np.full((H, W, 3), 22), frame * 255]).astype(np.uint8), 'RGBA')
d = ImageDraw.Draw(img); L = lambda a, b, w: d.line([(a[0] - X0, a[1] - Y0), (b[0] - X0, b[1] - Y0)], fill=(22, 22, 22, 255), width=w)
L((818, 792), FW, 9); L(CR, RW, 9); L((985, 795), RW, 7); L((962, 762), CR, 9)
img.save('props/bike_frame.png')
def wheel(path, r=R):
    S = 2 * r + 8; w = Image.new('RGBA', (S, S)); g = ImageDraw.Draw(w); c = S / 2
    g.ellipse((c - r, c - r, c + r, c + r), outline=(22, 22, 22, 255), width=11)
    for i in range(18):
        a = i * np.pi / 9; g.line((c, c, c + (r - 6) * np.cos(a), c + (r - 6) * np.sin(a)), fill=(22, 22, 22, 255), width=2)
    g.ellipse((c - 10, c - 10, c + 10, c + 10), fill=(22, 22, 22, 255)); w.save(path)
wheel('props/bike_wheel.png')
S = 110; cr = Image.new('RGBA', (S, S)); g = ImageDraw.Draw(cr); c = S / 2
g.ellipse((c - 30, c - 30, c + 30, c + 30), fill=(22, 22, 22, 255)); g.ellipse((c - 18, c - 18, c + 18, c + 18), fill=(0, 0, 0, 0)); g.ellipse((c - 8, c - 8, c + 8, c + 8), fill=(22, 22, 22, 255))
cr.save('props/bike_chainring.png')
json.dump({'box': [X0, Y0, X1, Y1], 'front': FW, 'rear': RW, 'crank': CR, 'r': R, 'saddle': [965, 742], 'bar': [835, 722], 'crank_len': 40,
           'height_m': 1.0}, open('props/bike.json', 'w'))
print('ok', img.size)
