# 把几张切好的姿势图并排、加网格（每 20px 细线、每 100px 粗线标数字），用来读锚点坐标（填 build_poses.py 的 ANCHOR / EXTRA）
# 用法：gridcut.py 输出.jpg 缩放 cut/A_door_v2_0.png cut/A_door_v2_1.png …
import sys
from PIL import Image, ImageDraw
out, z, files = sys.argv[1], float(sys.argv[2]), sys.argv[3:]
ims = []
for f in files:
    im = Image.open(f).convert('RGBA'); bg = Image.new('RGBA', im.size, (15, 28, 21, 255)); bg.alpha_composite(im)
    im = bg.convert('RGB').resize((int(im.width * z), int(im.height * z))); d = ImageDraw.Draw(im)
    for x in range(0, int(im.width / z), 20):
        X = x * z; c = (255, 255, 0) if x % 100 == 0 else (80, 80, 0); d.line([(X, 0), (X, im.height)], fill=c, width=1)
        if x % 100 == 0: d.text((X + 2, 2), str(x), fill=(255, 255, 0))
    for y in range(0, int(im.height / z), 20):
        Y = y * z; c = (255, 255, 0) if y % 100 == 0 else (80, 80, 0); d.line([(0, Y), (im.width, Y)], fill=c, width=1)
        if y % 100 == 0: d.text((2, Y + 2), str(y), fill=(255, 255, 0))
    d.text((6, im.height - 14), f.split('/')[-1], fill=(255, 120, 120)); ims.append(im)
W = sum(i.width for i in ims) + 10 * len(ims); H = max(i.height for i in ims)
sh = Image.new('RGB', (W, H), (40, 40, 40)); x = 0
for i in ims: sh.paste(i, (x, 0)); x += i.width + 10
sh.save(out, quality=88); print(sh.size)
