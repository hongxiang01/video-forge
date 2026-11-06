"""围墙外窄巷：L0 天空 / L1 远处楼群 / L2 近处两栋红顶平房 / L3 围墙（含碎玻璃、爬藤、路灯、地面）。"""
from split_util import *
a = load('3_wall.png'); H, W, _ = a.shape
erase_watermark(a)
yy = np.arange(H)[:, None] * np.ones((1, W)); xx = np.arange(W)[None, :] * np.ones((H, 1))
WALL = 590   # 墙顶压顶上沿
# L1 远处楼群：天际线折线以下
far = poly(a.shape, [(0, 276), (247, 276), (247, 360), (272, 360), (272, 198), (360, 198), (360, 180), (517, 180), (517, 198),
                     (602, 198), (610, 240), (610, 350), (775, 350), (775, 298), (792, 298), (792, 350), (832, 350), (832, 416),
                     (1012, 416), (1012, 463), (1180, 463), (1180, 338), (1250, 338), (1250, 303), (1392, 303), (1392, 338),
                     (1405, 338), (1405, 180), (1465, 142), (1525, 142), (1525, 124), (1592, 124), (1592, 140), (1768, 140),
                     (1768, 338), (1862, 338), (1862, 318), (1890, 296), (W, 296), (W, WALL + 10), (0, WALL + 10)])
# L2 近处红顶平房
near = poly(a.shape, [(0, 397), (518, 397), (600, 468), (600, WALL + 10), (0, WALL + 10)],
            [(1584, 488), (1624, 430), (W, 430), (W, WALL + 10), (1584, WALL + 10)])
# L3 围墙：墙顶以下 + 墙顶上的碎玻璃（景深外的背景是糊的，玻璃边缘锐利 → 用梯度找）+ 爬藤叶 + 路灯
lum = a.mean(2); sat = a.max(2) - a.min(2)
gm = np.hypot(nd.sobel(lum, 0), nd.sobel(lum, 1))
m = (gm > 60) & (yy > 515) & (yy < WALL + 2)
m = nd.binary_fill_holes(nd.binary_closing(m, iterations=4) | (yy >= WALL)) & (yy < WALL + 2)
m &= sat < 75
doors = poly(a.shape, [(90, 510), (310, 510), (310, WALL), (90, WALL)])   # 近处平房的两扇门框也很锐利，去掉细线
m = np.where(doors, nd.binary_opening(m, iterations=3), nd.binary_opening(m, iterations=1))
m = nd.binary_closing(m, iterations=2)
lab, _ = nd.label(m | (yy >= WALL)); shards = (lab == lab[H - 1, 5]) & (yy < WALL + 2)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
leaves = (g > r - 15) & (sat > 55) & (b < g - 40) & (yy > 530) & (yy < WALL + 2)
leaves = nd.binary_closing(nd.binary_opening(leaves, iterations=1), iterations=2)
lamp = poly(a.shape, [(1389, 446), (1416, 446), (1416, WALL + 5), (1389, WALL + 5)],
            [(1414, 505), (1440, 485), (1450, 470), (1475, 460), (1500, 453), (1515, 458), (1537, 481), (1500, 497),
             (1470, 503), (1440, 501), (1420, 515)],
            [(1383, 500), (1422, 500), (1422, 525), (1383, 525)])
wall = (yy >= WALL) | shards | leaves | lamp
build('wall', a, [far, near, wall], ['far', 'mid', 'mid', 'near'], 1000, 'outdoor',
      '地面线 y=1000 是墙根/人行道与路面交界；L3 含墙下方整条路面（y>1000），场景若自己铺地面可盖住。路灯光锥留在 L1 楼群上。')
