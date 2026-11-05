#!/usr/bin/env python3
"""幕后片讲解部分：按旁白时长排时间轴 → 切片段 / 出图 → 写 src/timeline.json → 混讲解部分音频 out/explainer.wav。

用法：~/mv-xue/lemo-opuscar/.venv/bin/python build.py
分镜见 ../script.md；旁白原文 vo_lines.txt，音频 public/vo/lNN.mp3（edge-tts 云健 +20%）。
"""
import json, os, re, shutil, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, 'public'); C = os.path.join(PUB, 'c'); os.makedirs(C, exist_ok=True)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
FILM = os.path.expanduser('~/video-forge/films/last-bowl')
SRC = {'v1': 'last-bowl-roughcut-v1.mp4', 'v2': 'last-bowl-roughcut-v2.mp4', 'v3': 'last-bowl-roughcut-v3.mp4',
       'v4': '最后一碗面-粗剪v4-三渲二.mp4', 'v5': '最后一碗面-粗剪v5.mp4', 'v6': '最后一碗面-最终版.mp4'}
BED = os.path.join(HERE, '..', 'music', 'library', 'A-Chillax.mp3')
FPS = 24
ZOOM = (176, 231, 976, 549)  # S4 左手局部（x, y, w, h），16:9


def ff(*a): subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)
def dur(p): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout)


# —— 1. 旁白时间轴 ——
N = len(open(os.path.join(HERE, 'vo_lines.txt'), encoding='utf-8').read().strip().splitlines())
D = {i: dur(os.path.join(PUB, 'vo', f'l{i:02d}.mp3')) for i in range(1, N + 1)}
SEG_END = {2, 4, 11, 13, 18, 22, 26}           # 段落末尾多停一会
MUSIC = 2.6                                     # 第 10 句后放第一版原声 2.6 秒
t, START = 0.6, {}
for i in range(1, N + 1):
    START[i] = t
    t += D[i] + (0.9 if i in SEG_END else 0.35)
    if i == 10: MUS_AT = START[10] + D[10] + 0.3; t = MUS_AT + MUSIC + 0.3
PUSH_AT = START[N] + D[N] + 0.4                 # 最后一句说完 0.4 s 后推进大屏
END = PUSH_AT + 1.2                             # 推进 1.2 s 后，正好落在第六版第一帧
L = lambda i: START[i]


# —— 2. 分镜：每屏的版式、片段、关键词、圈（圈的坐标是源画面 1920×1080 坐标）——
def clip(v, t0, t1, name=None, crop=None):
    name = name or f'{v}_{t0:g}_{t1:g}' + ('_z' if crop else '')
    p = os.path.join(C, name + '.mp4')
    if not os.path.exists(p):
        vf = (f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},scale=1920:1080,' if crop else '') + 'format=yuv420p'
        ff('-ss', str(t0), '-t', str(t1 - t0), '-i', os.path.join(FILM, 'out', SRC[v]), '-vf', vf,
           '-c:v', 'libx264', '-crf', '16', '-preset', 'veryfast', '-an', p)
    return {'src': f'c/{name}.mp4', 'len': t1 - t0}


def still(v, at, name, crop=None):
    p = os.path.join(C, name + '.png')
    if not os.path.exists(p):
        vf = (f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},scale=1920:1080' if crop else 'null')
        ff('-ss', str(at), '-i', os.path.join(FILM, 'out', SRC[v]), '-frames:v', '1', '-vf', vf, p)
    return {'img': f'c/{name}.png'}


def copy_img(rel, name):
    p = os.path.join(C, name); shutil.copy(os.path.join(FILM, 'stills', rel), p); return {'img': f'c/{name}'}


def masks():
    """第五版 S3 伸手的 6 张画：前臂压住面团的像素标红（遮罩来自第六轮测量 stills/r6/s3-reach/mask_before）"""
    out = []
    for i, t in enumerate(['6.17', '6.25', '6.3334', '6.4167', '6.5', '6.5834']):
        p = os.path.join(C, f'mask_{i}.png')
        if not os.path.exists(p):
            ff('-ss', str(float(t) + 0.001), '-i', os.path.join(FILM, 'out', SRC['v5']), '-frames:v', '1', p)
            im = Image.open(p).convert('RGB'); px = im.load()
            mb = os.path.join(FILM, 'stills', 'r6', 's3-reach', 'mask_before')
            a = Image.open(f'{mb}/armR/t_{t}.jpg').convert('L').resize(im.size).load()
            d = Image.open(f'{mb}/dough/t_{t}.jpg').convert('L').resize(im.size).load()
            for y in range(920):                    # 字幕在 920 以下，遮罩里也是黑的
                for x in range(im.size[0]):
                    if a[x, y] < 128 and d[x, y] < 128: px[x, y] = (235, 40, 40)
            im.save(p)
        out.append({'img': f'c/mask_{i}.png'})
    return out


S4 = {v: clip(v, 9, 12, f's4_{v}') for v in SRC}
SHOTS = [
    dict(id='Ⅰ-1', at=0, layout='single', clips=[clip('v6', 12, 15)], kw=[('一句话能生成动画吗？', L(1) + .3)]),
    dict(id='Ⅰ-2', at=L(2) - .15, layout='six', clips=[S4[v] for v in SRC], labels=['第一版', '第二版', '第三版', '第四版', '第五版', '第六版'],
         kw=[('改了六版', L(2) + 2.6)]),
    dict(id='Ⅰ-3', at=L(2) + D[2] * .72, layout='single', clips=[clip('v6', 21, 24)], kw=[]),
    dict(id='Ⅱ-1', at=L(3) - .15, layout='single', clips=[clip('v6', 24, 27)], kw=[('八十年代赛璐璐', L(3) + 2.2)]),
    dict(id='Ⅱ-2', at=L(4) - .15, layout='images', imgs=[copy_img('a-r3/final/a_2.0.jpg', 'p1.jpg'), copy_img('hands/raw_2.jpg', 'p2.jpg'),
                                                         copy_img('rough-v6/sheet.jpg', 'p3.jpg'), copy_img('r6/s4-pin/sheet36-after.jpg', 'p4.jpg')],
         kw=[('每一帧都是代码画的', L(4) + .4)]),
    dict(id='Ⅲ-1', at=L(5) - .15, layout='single', clips=[clip('v1', 0, 3)], labels=['第一版'], kw=[('第一版：二十分钟', L(5) + .3)]),
    dict(id='Ⅲ-2', at=L(6) - .15, layout='dual', clips=[clip('v1', 0, 3), clip('v1', 6, 9)], labels=['主镜头', '第三镜'],
         kw=[('窗户换了一扇', L(6) + .2)], co=[dict(screen=1, cx=960, cy=355, rx=640, ry=316, at=L(6) + .5)]),
    dict(id='Ⅲ-3', at=L(7) - .15, layout='single', clips=[clip('v1', 33.6, 36)], labels=['第一版'],
         kw=[('手从上面伸进来', L(7) + .2)], co=[dict(screen=0, cx=1130, cy=150, rx=260, ry=200, at=L(7) + .4)]),
    dict(id='Ⅲ-4', at=L(8) - .15, layout='single', clips=[clip('v1', 15.5, 17.5)], labels=['第一版'],
         kw=[('刀像砍刀', L(8) + .1)], co=[dict(screen=0, cx=1270, cy=330, rx=260, ry=280, at=L(8) + .3)]),
    dict(id='Ⅲ-5', at=L(9) - .15, layout='single', clips=[clip('v1', 10, 12)], labels=['第一版'],
         kw=[('擀面杖滚到了桌上', L(9) + .3)], co=[dict(screen=0, cx=960, cy=735, rx=495, ry=142, at=L(9) + 1.6)]),
    dict(id='Ⅲ-6', at=L(10) - .15, layout='single', clips=[clip('v1', 9.0 - (MUS_AT - L(10) + .15), 9.0 - (MUS_AT - L(10) + .15) + 8.2, 'v1_music')],
         labels=['第一版'], kw=[('AI 听不见自己的曲子', L(11) + .2)]),
    dict(id='Ⅳ-1', at=L(12) - .15, layout='trio', clips=[S4['v1'], S4['v2'], S4['v3']], labels=['第一版', '第二版', '第三版'],
         kw=[('平面画法改了三版', L(12) + .3)]),
    dict(id='Ⅳ-2', at=L(13) - .15, layout='sticker', kw=[('杖和面是两张贴纸', L(13) + 3.2)]),
    dict(id='Ⅴ-1', at=L(14) - .15, layout='dual', clips=[S4['v3'], S4['v6']], labels=['第三版', '第六版'], kw=[('三渲二', L(14) + .2)]),
    dict(id='Ⅴ-2', at=L(15) - .15, layout='single', clips=[clip('v6', 15, 18)], kw=[('带骨骼的三维手', L(15) + .3)]),
    dict(id='Ⅴ-3', at=L(16) - .15, layout='single', clips=[S4['v6']], kw=[('杖真的压着面', L(16) + .3)]),
    dict(id='Ⅴ-4', at=L(17) - .15, layout='single', clips=[clip('v6', 24, 27)], kw=[('灯打出硬边影子', L(17) + .2)]),
    dict(id='Ⅴ-5', at=L(18) - .15, layout='single', clips=[clip('v6', 27, 33)], kw=[('两色上色 + 彩色描边', L(18) + 1.0)]),
    dict(id='Ⅵ-1', at=L(19) - .15, layout='single', clips=[S4['v5']], labels=['第五版'], kw=[('自检：只剩三个小毛病', L(19) + 2.2)]),
    dict(id='Ⅵ-2', at=L(20) - .15, layout='dual', clips=[clip('v5', 9, 12, crop=ZOOM), clip('v6', 9, 12, crop=ZOOM)], labels=['第五版', '第六版'],
         kw=[('拇指插进了擀面杖', L(20) + .3)]),
    dict(id='Ⅵ-3', at=L(21) - .15, layout='dual', clips=[still('v5', 10.667, 'z5', ZOOM), still('v6', 10.667, 'z6', ZOOM)], labels=['第五版', '第六版'],
         push=True, kw=[('36 张画全穿', L(21) + .2)], co=[dict(screen=0, cx=1300, cy=720, rx=190, ry=130, at=L(21) + .2)]),
    dict(id='Ⅵ-4', at=L(22) - .15, layout='mask', imgs=masks(), labels=['第五版'], kw=[('实测只有 1.6%', L(22) + 2.4)]),
    dict(id='Ⅶ-1', at=L(23) - .15, layout='single', clips=[clip('v6', 4.6, 8.6)], kw=[('有手的镜头全部三维', L(23) + .3)]),
    dict(id='Ⅶ-2', at=L(24) - .15, layout='single', clips=[clip('v6', 9, 12, crop=ZOOM)], kw=[('手和杖最多差 1 毫米', L(24) + .3)]),
    dict(id='Ⅶ-3', at=L(25) - .15, layout='single', clips=[clip('v6', 33, 36)], kw=[('配乐换成真人作曲', L(25) + .3)]),
    dict(id='Ⅶ-4', at=L(26) - .15, layout='single', clips=[clip('v6', 36, 40.5)], kw=[('最后还得人来看、来量', L(26) + .3)]),
    dict(id='Ⅷ-0', at=L(27) - .15, layout='pushin', imgs=[still('v6', 0.0, 'v6_f0')], push_at=PUSH_AT, kw=[]),
]
for k, s in enumerate(SHOTS):
    s['end'] = SHOTS[k + 1]['at'] if k + 1 < len(SHOTS) else END
    s['dur'] = s['end'] - s['at']
    s['clips'] = [dict(c) for c in s.get('clips', [])]    # 同一个片段会被几屏共用，各算各的速度
    for c in s['clips']:                # 片段放得完：不够长就慢放，最慢 0.35 倍（向下取整，保证放得满）
        if 'len' not in c: continue             # 静帧
        c['rate'] = min(1.0, int(c['len'] / s['dur'] * 1000) / 1000)
        if c['len'] / c['rate'] < s['dur'] - 1e-3: print(f"!! {s['id']} 片段不够长：{c['src']} {c['len']}s / {s['dur']:.2f}s")
        if c['rate'] < .35: print(f"!! {s['id']} 慢放过头：{c['rate']}")

tl = dict(fps=FPS, end=END, push_at=PUSH_AT, shots=SHOTS, lines={i: [START[i], D[i]] for i in START})
json.dump(tl, open(os.path.join(HERE, 'src', 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
print(f'讲解部分 {END:.2f} s = {round(END * FPS)} 帧；第一版原声 {MUS_AT:.2f}–{MUS_AT + MUSIC:.2f} s')
for s in SHOTS: print(f"{s['id']:5s} {s['at']:6.2f}–{s['end']:6.2f}  {s['layout']:7s} " + ' '.join(f"{c['src'].split('/')[-1]}×{c['rate']}" if 'src' in c else c['img'].split('/')[-1] for c in s['clips']))


# —— 3. 讲解部分音频：旁白 −14 LUFS；Chillax 垫底，比旁白低约 12 dB；第一版原声那 2.6 秒底乐让开 ——
def lufs(p, pre=''):
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', pre + 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', e)[-1])


vo = os.path.join(OUT, 'vo.wav')
ins, flt = [], []
for i in START:
    ins += ['-i', os.path.join(PUB, 'vo', f'l{i:02d}.mp3')]
    ms = round(START[i] * 1000); flt.append(f'[{i - 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay={ms}|{ms}[a{i}]')
ff(*ins, '-filter_complex', ';'.join(flt) + ';' + ''.join(f'[a{i}]' for i in START) + f'amix=inputs={len(START)}:normalize=0,apad=whole_dur={END},atrim=0:{END}', '-c:a', 'pcm_f32le', vo)
g_vo = -14 - lufs(vo)
mus = os.path.join(OUT, 'v1music.wav')
ff('-ss', '9.0', '-t', str(MUSIC), '-i', os.path.join(FILM, 'out', SRC['v1']), '-vn', '-af',
   f'aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.08,afade=t=out:st={MUSIC - .25}:d=0.25', '-c:a', 'pcm_f32le', mus)
g_mus = -16 - lufs(mus)
bed = os.path.join(OUT, 'bed.wav')
duck = f"volume='if(between(t,{MUS_AT - .4:.2f},{MUS_AT + MUSIC + .3:.2f}),0.05,1)':eval=frame"
ff('-i', BED, '-af', f'aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{END},{duck},afade=t=in:d=1.5,afade=t=out:st={PUSH_AT:.2f}:d={END - PUSH_AT:.2f}',
   '-c:a', 'pcm_f32le', bed)
g_bed = -26 - lufs(bed)
mix = os.path.join(OUT, 'explainer.wav')
ff('-i', vo, '-i', mus, '-i', bed, '-filter_complex',
   f'[0:a]volume={g_vo:.2f}dB[v];[1:a]volume={g_mus:.2f}dB,adelay={round(MUS_AT * 1000)}|{round(MUS_AT * 1000)}[m];[2:a]volume={g_bed:.2f}dB[b];'
   f'[v][m][b]amix=inputs=3:normalize=0,alimiter=limit=0.84:level=0,atrim=0:{END}', '-c:a', 'pcm_s16le', mix)
print(f'讲解音频 {lufs(mix):.1f} LUFS（旁白增益 {g_vo:+.1f} dB，底乐 {g_bed:+.1f} dB）→ {mix}')
