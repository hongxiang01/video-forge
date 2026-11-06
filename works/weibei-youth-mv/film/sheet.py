"""把一组 PNG 拼成联系表：python sheet.py 输出.jpg 列数 文件...（每格标文件名）"""
import sys
from PIL import Image, ImageDraw, ImageFont
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
w, h = 640, 360; f = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 22)
rows = (len(files) + cols - 1) // cols; c = Image.new('RGB', (cols * w, rows * h), 'black'); d = ImageDraw.Draw(c)
for i, fn in enumerate(files):
    x, y = i % cols * w, i // cols * h; c.paste(Image.open(fn).convert('RGB').resize((w, h)), (x, y))
    lab = fn.split('/')[-1].replace('.png', ''); d.rectangle((x, y, x + 150, y + 30), fill='black'); d.text((x + 6, y + 3), lab, font=f, fill='yellow')
c.save(out, quality=85)
