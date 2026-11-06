"""切好的姿势 / 道具 → poses.json（片子里用）+ 叠影检查图。
比例 k（每像素多少世界单位）：人物组按站直身高（耳尖到鞋底，像素）对到角色的世界身高（和骨骼版同一身高，镜头取景不用改）；
半身、特写、道具、场景直接给 k。
锚点默认是脚底点（cut_sheet 算的最低实心行中点），按用途手动改（ANCHOR）：
- 跳：锚在髋（空中按髋的弧线走）；fy = 鞋底线，落地张用 fy - ay 算髋高
- 画门：锚在粉笔尖的 x、鞋底线的 y（门框线永远在粉笔尖上）
- 走：锚在支撑脚的脚跟（落地张锚后脚跟，front = 前脚跟），一步的步长 = front - ax
其余点（EXTRA）：tip 粉笔尖 / 指尖，palm 手心，boat 手里的船。都是切图里的像素坐标。
用法：build_poses.py   （在 design/poses 下运行）"""
import json, numpy as np
from PIL import Image, ImageDraw

WORLD_H = {'adult': 877, 'kid': 483}   # 骨骼版站直身高（世界单位）：adult (1052-95)*0.916，kid (1027-118)*0.531
SHEETS = {
    'A_hop_v2': dict(who='adult', h=630),     # 没有站直的一张：落地那张 612，膝盖微弯，按 3% 补
    'A_coin_v2': dict(who='adult', h=770),
    'A_door_v2': dict(who='adult', h=655),
    'A_walk_v2': dict(who='adult', h=688),
    'K_star_v1': dict(who='kid', h=703),
    'K_rest': dict(who='kid', h=909),         # 全身设定图（站着不动）
    'A_rest': dict(who='adult', h=957),
    'K_boat_v1': dict(who='kid', h=674),
    'P_river_v1': dict(k=0.74),               # 河宽（浪带厚）约 270 像素 → 200 世界单位
    'P_dock_v1': dict(k=0.64, fade=0.18),     # 岸 + 木桩（画里那段水擦掉了，河从木桩下穿过去）；木桩露出水面 282 像素 → 180
    'P_bank_v1': dict(k=0.64, fade=0.18),     # 只有草的一段岸，镜像过来垫在少年脚下
    'P_boat_v1': dict(k=0.27),                # 船长约 420 像素 → 115（和少年手里那只一样大）
    'P_crowd_v1': dict(k=0.75),
    'A_runback_v1': dict(who='adult', h=590, mode='headx_sheety'),
    'A_barrier_v1': dict(who='adult', h=790),
    'A_place_v1': dict(who='adult', h=850),
    'A_sit_v1': dict(who='adult', h=807),
    'K_sit_v1': dict(k=0.70),
    'A_away_v1': dict(who='adult', h=770, mode='headx_sheety'),
    'K_land_v1': dict(who='kid', h=722, mode='headx_sheety'),
    'K_run_v1': dict(k=0.787, mode='headx_sheety'),
    'K_spin_v1': dict(who='kid', h=650, mode='headx_sheety'),
    'A_wipe_v1': dict(who='adult', h=600),
    'A_rise_v1': dict(who='adult', h=770),
    'A_squeeze_v1': dict(who='adult', h=630),
    'A_chalk_v1': dict(k=0.6, fade=0.16),      # 半身：下缘淡出（粉笔速写的收边）
    'A_hesitate_v1': dict(k=0.57, fade=0.16),
    'A_flick_v1': dict(k=0.55, fade=0.16),
    'A_turn_v1': dict(k=0.55, fade=0.16),
    'K_lookup_v1': dict(k=0.5, fade=0.16),
    'A_face_v1': dict(k=0.35, fade=0.12),
    'K_face_v1': dict(k=0.27, fade=0.12),
    'A_feet_v1': dict(k=0.42, mode='headx_sheety'),
    'P_props_v1': dict(k=0.55),
    'P_crowd_v2': dict(k=0.75, mode='group', at=(1007, 1000)),   # 狐狸版嘲笑人群：切成 6 块，锚点都指向同一个图上的点，放在同一处就拼回整组
    'A_squeeze_v2': dict(who='adult', h=779),
    'A_rise_v2': dict(who='adult', h=729),
    'A_face_v2': dict(k=0.35, fade=0.12),     # 同角度睁眼 / 闭眼（S06 眨眼）
    'K_face_v2': dict(k=0.27, fade=0.12),     # 同角度睁眼 / 闭眼（S24）
}
KOVR = {'P_props_v1_1': 0.2, 'P_props_v1_2': 0.17, 'P_props_v1_3': 0.17}   # 粉笔头、硬币单独定比例（公文包用组比例）
# mode headx_sheety：x = 头的中心（跑、走的时候头走得最平稳），y = 这一组的共同地面线（腾空的那张自然在地面上方）
ANCHOR = {
    'A_hop_v2_0': (255, 330), 'A_hop_v2_1': (265, 350), 'A_hop_v2_2': (300, 330), 'A_hop_v2_3': (262, 381),
    'A_door_v2_0': (498, 425), 'A_door_v2_1': (487, 515), 'A_door_v2_2': (419, 660), 'A_door_v2_3': (447, 795),
    'A_walk_v2_0': (155, 659), 'A_walk_v2_1': (270, 598), 'A_walk_v2_2': (248, 693), 'A_walk_v2_3': (140, 637),
    'K_rest_0': (396, 920), 'A_rest_0': (342, 964),
    'P_river_v1_0': (0, 81),                  # 左上角，y = 最上面一道浪的中位线
    'P_dock_v1_0': (542, 544),                # 木桩中心 x、木桩入水处 y
    'P_bank_v1_0': (574, 60),                 # 右上角（镜像后在左边，出画）
    'P_crowd_v1_0': (702, 690),
    'A_sit_v1_0': (325, 347), 'A_sit_v1_1': (394, 398),     # 坐着两张都锚在桌面左上角：桌子不动，人站起来往后退
    'A_runback_v1_0': (279, 583),
    'A_barrier_v1_0': (7, 771), 'A_barrier_v1_1': (8, 720), 'A_barrier_v1_2': (8, 578),   # 锚在贴墙的手掌 x、鞋底线 y
    'A_place_v1_1': (89, 629),                                # 锚在放下的硬币 x
    'A_face_v1_0': (540, 615),                                # 锚在近处那片眼镜片中心（S06 星星映在这里）
    'A_face_v2_0': (500, 517), 'A_face_v2_1': (488, 533),
    'A_hesitate_v1_0': (487, 440), 'A_hesitate_v1_1': (499, 430),   # 锚在粉笔尖
    'P_props_v1_0': (259, 366), 'P_props_v1_1': (150, 115), 'P_props_v1_2': (132, 129), 'P_props_v1_3': (184, 160),   # 公文包锚在底边中点，粉笔头、硬币锚在中心

}
EXTRA = {
    'A_door_v2_0': dict(tip=(498, 396)), 'A_door_v2_1': dict(tip=(487, 256)), 'A_door_v2_2': dict(tip=(419, 108)), 'A_door_v2_3': dict(tip=(447, 23)),
    'A_walk_v2_0': dict(front=372), 'A_walk_v2_3': dict(front=355),
    'A_coin_v2_0': dict(palm=(452, 282)), 'A_coin_v2_1': dict(palm=(416, 295)), 'A_coin_v2_3': dict(tip=(428, 225)),
    'K_star_v1_1': dict(tip=(28, 267)), 'K_star_v1_2': dict(tip=(502, 138)), 'K_star_v1_3': dict(tip=(584, 164)),
    'K_boat_v1_2': dict(boat=(461, 440)), 'K_boat_v1_1': dict(boat=(455, 330)),
    'A_sit_v1_0': dict(desktop=(325, 347), deskR=608, ground=693), 'A_sit_v1_1': dict(ground=744),
    'A_place_v1_1': dict(coin=(89, 576)),
    'A_squeeze_v1_2': dict(tip=(316, 247)), 'A_squeeze_v2_2': dict(tip=(504, 259)), 'A_flick_v1_0': dict(coin=(520, 600)),
    'P_props_v1_2': dict(r=112), 'P_props_v1_3': dict(r=155),
    'A_chalk_v1_1': dict(tip=(675, 591)), 'A_chalk_v1_2': dict(tip=(556, 763)),
    'K_run_v1_0': dict(tip=(535, 242)), 'K_run_v1_1': dict(tip=(520, 218)), 'K_run_v1_2': dict(tip=(516, 230)), 'K_run_v1_3': dict(tip=(510, 231)),
}

# river_crop：河裁掉左右两端各 10 像素（抠图留的软边，镜像拼接时会成一道细缝）；重切河以后会自动再裁
_r = Image.open('cut/P_river_v1_0.png')
if _r.width == 2048: _r.crop((10, 0, 2038, _r.height)).save('cut/P_river_v1_0.png')

def head_x(pid):
    al = np.asarray(Image.open(f'cut/{pid}.png'))[..., 3] > 128
    rows = np.where(al.any(1))[0]; top = rows.min(); hh = int((rows.max() - top) * 0.22)
    return float(np.where(al[top:top + hh])[1].mean())

# 同一组里对齐（半身、特写换张时人不跳）：组 → (参考张, 模板框)。拿参考张里这块（占切图宽高的比例）到其他张里做模板匹配，
# 找到同一块的位置 → 锚点跟着挪。脸：眼镜那块；半身：头（转粉笔、弹硬币）或躯干（转身、低头）
REG = {'A_face_v2': (0, (0.30, 0.33, 0.96, 0.61)), 'K_face_v2': (0, (0.15, 0.19, 0.95, 0.49)),
       'A_chalk_v1': (1, (0.15, 0.05, 0.85, 0.45)), 'A_flick_v1': (0, (0.15, 0.05, 0.85, 0.45)),
       'A_turn_v1': (0, (0.15, 0.50, 0.85, 0.85)), 'K_lookup_v1': (0, (0.15, 0.55, 0.85, 0.90))}
from skimage.feature import match_template
def lumimg(pid):
    a = np.asarray(Image.open(f'cut/{pid}.png').convert('RGBA')).astype(float); return a[..., :3].mean(2) * (a[..., 3] / 255)

out = {}
for sh, o in SHEETS.items():
    J = json.load(open(f'cut/{sh}.json'))
    k = o['k'] if 'k' in o else WORLD_H[o['who']] / o['h']
    ground = max(f['box'][1] + f['foot'][1] for f in J['figs'])
    for f in J['figs']:
        pid = f'{sh}_{f["i"]}'
        if o.get('mode') == 'group': ax, ay = o['at'][0] - f['box'][0], o['at'][1] - f['box'][1]
        else: ax, ay = ANCHOR.get(pid, (head_x(pid), ground - f['box'][1]) if o.get('mode') == 'headx_sheety' else f['foot'])
        e = {kk: (list(v) if isinstance(v, tuple) else v) for kk, v in EXTRA.get(pid, {}).items()}
        src = f'design/poses/cut/{pid}.png'
        if o.get('fade'):   # 下缘淡出：另存 _f.png（重跑不会叠加淡出）
            im = Image.open(f'cut/{pid}.png').convert('RGBA'); a = np.asarray(im).astype(float); h = a.shape[0]
            y = np.arange(h)[:, None]; y0 = h * (1 - o['fade']); u = np.clip((y - y0) / (h - y0), 0, 1)
            a[..., 3] *= 1 - u * u * (3 - 2 * u)
            # 左右、上边如果是被画面边缘切开的（最外 3 列 / 行还很实），也淡出，不留一刀切的直边
            w = a.shape[1]; fw = int(w * 0.08)
            xs = np.arange(w)[None, :]
            if (a[:, :12, 3] > 128).mean() > 0.08: a[..., 3] *= np.clip(xs / fw, 0, 1) ** 1.5
            if (a[:, -12:, 3] > 128).mean() > 0.08: a[..., 3] *= np.clip((w - 1 - xs) / fw, 0, 1) ** 1.5
            if (a[:12, :, 3] > 128).mean() > 0.08: a[..., 3] *= np.clip(y / int(h * 0.06), 0, 1) ** 1.5
            Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA').save(f'cut/{pid}_f.png'); src = f'design/poses/cut/{pid}_f.png'
        out[pid] = dict(src=src, ax=round(ax, 1), ay=round(ay, 1), k=round(KOVR.get(pid, k), 4), fy=round(f['foot'][1], 1), foot=[round(f['foot'][0], 1), round(f['foot'][1], 1)], **e)

# 河面：每 8 像素一列取最上面的实心像素（平滑），船贴着它漂
a = np.asarray(Image.open('cut/P_river_v1_0.png'))[..., 3] > 128
tops = []
for x in range(0, a.shape[1], 8):
    col = np.where(a[:, x])[0]
    tops.append(float(col.min()) if len(col) else np.nan)
tops = np.array(tops); idx = np.arange(len(tops)); tops = np.interp(idx, idx[~np.isnan(tops)], tops[~np.isnan(tops)])
tops = np.convolve(np.pad(tops, 3, mode='edge'), np.ones(7) / 7, mode='valid')
out['P_river_v1_0']['tops'] = [round(v, 1) for v in tops]; out['P_river_v1_0']['topStep'] = 8
for sh, (ri, fb) in REG.items():
    ids = sorted([p for p in out if p.startswith(sh + '_')], key=lambda q: int(q.rsplit('_', 1)[1])); ref = ids[ri]
    A = lumimg(ref); h, w = A.shape; x0, y0, x1, y1 = int(fb[0] * w), int(fb[1] * h), int(fb[2] * w), int(fb[3] * h); T = A[y0:y1, x0:x1]
    for pid in ids:
        if pid == ref: continue
        B = lumimg(pid)
        if B.shape[0] < T.shape[0] or B.shape[1] < T.shape[1]: print('skip', pid); continue
        r = match_template(B, T); iy, ix = np.unravel_index(np.argmax(r), r.shape)
        out[pid]['ax'] = round(float(out[ref]['ax'] + ix - x0), 1); out[pid]['ay'] = round(float(out[ref]['ay'] + iy - y0), 1)
        print('align', pid, '->', ref, 'shift', ix - x0, iy - y0, 'score', round(float(r.max()), 2))
json.dump(out, open('poses.json', 'w'), indent=1)
print(len(out), 'poses')
