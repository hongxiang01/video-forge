import sys
from PIL import Image, ImageDraw
src, out, x0, y0, x1, y1 = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7]); z = float(sys.argv[7]) if len(sys.argv) > 7 else 1
im = Image.open(src).convert('RGBA').crop((x0, y0, x1, y1)); bg = Image.new('RGBA', im.size, (15, 28, 21, 255)); bg.alpha_composite(im)
im = bg.convert('RGB').resize((int((x1 - x0) * z), int((y1 - y0) * z))); d = ImageDraw.Draw(im)
for x in range((x0 // 20 + 1) * 20, x1, 20):
    X = (x - x0) * z; c = (255, 255, 0) if x % 100 == 0 else (90, 90, 0); d.line([(X, 0), (X, im.height)], fill=c, width=1)
    if x % 100 == 0: d.text((X + 2, 2), str(x), fill=(255, 255, 0))
for y in range((y0 // 20 + 1) * 20, y1, 20):
    Y = (y - y0) * z; c = (255, 255, 0) if y % 100 == 0 else (90, 90, 0); d.line([(0, Y), (im.width, Y)], fill=c, width=1)
    if y % 100 == 0: d.text((2, Y + 2), str(y), fill=(255, 255, 0))
im.save(out, quality=90); print(im.size)
