"""《最后一碗面》换配乐：音效照 films/last-bowl/audio/build.py 原样重渲（拟音 sfx、环境底 amb、磁带嘶 hiss），
配乐换成 Mixkit「Chillax」（Francisco Alvear，Mixkit Stock Music Free License）的 62.0–107.0 s → film_newmix.wav（48 kHz 立体声，正好 45.0 s）。
用法：~/mv-xue/lemo-opuscar/.venv/bin/python film_audio.py
· 旧配乐一个音都不进：import build.py 之前先放一个空的 music 模块，music.py 根本不加载；build.py 的写文件逻辑全在它的 __main__ 里，import 不触发。
  music.py 只用 lemo 采样器自己的随机数，不碰 sfx / foley 的随机数，所以 place_foley() 渲出的音效和原版逐样本相同。
· 两段真静默（30.00–30.75、36.00–36.75）一个样本都不进：配乐在静默前 0.3 s 淡到无声、静默后 0.5 s 淡回来，最后再把静默窗口清零。
· 配乐电平：干活段（拟音密的段）中位数比拟音低 4 dB（原设计 3–5 dB）；闪避照原设计（咔、刀、落水、哐时压 6 dB）。
· 响度、真峰值和 build.py 同一套：−14 LUFS（ffmpeg loudnorm 量），真峰值前瞻限幅到 CEIL_DB（mux 的 AAC 还会冒 ~1.2 dB，成片要 ≤ −1.5）。"""
import os, subprocess, sys, types
sys.dont_write_bytecode = True                      # import build / foley 时不往 films/last-bowl/audio/__pycache__ 写 .pyc（那个目录一个文件都不能动）
import numpy as np
import soxr
from scipy.io import wavfile

FILM_AUDIO = os.path.expanduser('~/video-forge/films/last-bowl/audio')
sys.path.insert(0, FILM_AUDIO)
sys.modules['music'] = types.ModuleType('music')    # 空模块顶替 music.py：旧配乐连加载都不加载
import build as B                                   # noqa: E402  只用它的函数和常量

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.expanduser('~/video-forge/works/last-bowl-making-of/music/library/A-Chillax.mp3')
OUT = os.path.join(HERE, 'film_newmix.wav')
SR, N, DUR = B.SR, B.N, B.DUR
T0 = 62.0                                           # 取 Chillax 62.0–107.0 s
ENV = [(0, 0), (1.0, 1), (29.7, 1), (30.0, 0), (30.75, 0), (31.25, 1),     # 片头 1.0 s 淡入；真静默 1 前 0.3 s 淡出、后 0.5 s 淡入
       (35.7, 1), (36.0, 0), (36.75, 0), (37.25, 1), (43.5, 1), (45.0, 0)]  # 真静默 2 同样；43.5–45.0 淡出
DUCK = True                                         # 原设计的闪避（build.duck）；不要就改 False
TARGET = -4.0                                       # 干活段配乐 − 拟音（dB，中位数）
CEIL_DB = -3.0                                      # WAV 真峰值上限：build.py 用 −2.6，但这一版 mux 后 AAC 在 18.0 s 落水处冒了 1.2 dB（成片 −1.4 dBTP，超了），所以再压 0.4 dB
ROWS = [(0, .75, '门铃 + 风'), (.75, 3.0, '咔 · 吊链'), (3.0, 4.5, '面粉'), (4.5, 6.0, '衣袖 · 压窝'), (6.0, 9.0, '揉面咚 ×4'),
        (9.0, 10.5, '咕噜 ×2'), (10.5, 11.25, '嗒'), (11.25, 12.0, '咕噜 ×1'), (12.0, 13.5, '抬起'), (13.5, 15.0, '面片举定'),
        (15.0, 16.5, '刀 ×4'), (16.5, 17.25, '刀 ×2 更近'), (17.25, 18.0, '簌簌 · 滚水先进'), (18.0, 19.5, '落水'), (19.5, 21.0, '蒸汽'),
        (21.0, 23.25, '外景'), (23.25, 24.0, '舀汤先进'), (24.0, 24.75, '盛面'), (24.75, 25.5, '浇汤 · 叮'), (25.5, 27.0, '两撮葱'),
        (27.0, 27.75, '碗擦木'), (27.75, 28.5, '衣料'), (28.5, 30.0, '瓷叮'), (30.0, 30.75, '真静默 1'), (30.75, 32.25, '门铃'),
        (32.25, 33.0, '碗离台'), (33.0, 34.5, '湿布'), (34.5, 35.25, '掌落木'), (35.25, 36.0, '袖子擦过'), (36.0, 36.75, '真静默 2'),
        (36.75, 38.25, '咔 · 风 · 门铃闷'), (38.25, 40.5, '卷帘'), (40.5, 41.25, '哐 · 电流嘶'), (41.25, 44.25, '片名'), (44.25, 45.0, '磁带嘶 · 配乐淡出')]
WORK = {6.0, 9.0, 11.25, 15.0, 16.5, 17.25, 18.0, 19.5, 24.75, 33.0}       # 干活段（揉、擀、切、下锅、蒸汽、浇汤、湿布）；原版这些段中位数 −3.1 dB（build.log）


def chillax():
    """整首解码（44.1 kHz MP3 → float），soxr 重采样到 48 kHz，按样本切 T0 起 45.0 s"""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', SRC, '-ac', '2', '-f', 'f32le', '-'], capture_output=True, check=True)
    sr0 = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', SRC],
                             capture_output=True, check=True, text=True).stdout.strip())
    x = soxr.resample(np.frombuffer(r.stdout, np.float32).reshape(-1, 2).astype(np.float64), sr0, SR, 'VHQ')
    i = int(round(T0 * SR)); seg = x[i:i + N]
    assert len(seg) == N, f'Chillax 不够长：{len(x) / SR:.2f} s'
    return seg


def sfx_buses():
    """音效三条总线：和 build.py __main__ 同样的分段渲染、房间混响（拟音）、总线增益、段窗口、段 C 收尾（磁带嘶除外）"""
    B.place_foley()
    room = B.ir(.6, .12, 6000, 5); t = np.arange(N) / SR; endC = np.clip((44.25 - t) / .65, 0, 1)[:, None]
    bus = {k: np.zeros((N, 2)) for k in ('sfx', 'amb', 'hiss')}
    for s, (a, b) in enumerate(B.SEGS):
        w = B.window(a, b)[:, None]
        parts = {'sfx': B.verb(B.stems[(s, 'sfx')], room, .12), 'amb': B.stems[(s, 'amb')] * 2.2, 'hiss': B.stems[(s, 'hiss')] * 3.0}
        for k, x in parts.items(): bus[k] += x * w * (endC if (s == 2 and k != 'hiss') else 1.0)
    return bus


def rows_db(x): return [B.db(x[int(round(a * SR)):int(round(b * SR))]) for a, b, _ in ROWS]


if __name__ == '__main__':
    bus = sfx_buses()
    mus = chillax() * B.ramp(ENV, 0, DUR)[:, None] * (B.duck()[:, None] if DUCK else 1.0)
    diff = [m - s for (a, _, _), m, s in zip(ROWS, rows_db(mus), rows_db(bus['sfx'])) if a in WORK]
    mus_gain = 10 ** ((TARGET - float(np.median(diff))) / 20); bus['mus'] = mus * mus_gain
    print(f'配乐总线增益 {20 * np.log10(mus_gain):+.1f} dB（干活段配乐 − 拟音 中位数对到 {TARGET:+.1f} dB）')

    mix = sum(bus.values())
    for c in range(2): mix[:, c] = B.limit(mix[:, c], ceil=.8)
    gain = 1.0; ceil = 10 ** (CEIL_DB / 20)
    for _ in range(4):                                  # build.py 迭代 2 次（WAV −14.2）；4 次限幅吃掉的响度更少，更贴近 −14.0
        g = 10 ** ((-14.0 - B.lufs(mix)) / 20); mix *= g; gain *= g
        mix *= B.tp_limit(mix, ceil)[:, None]
    mix *= min(1.0, ceil / B.tpeak(mix))
    for a, b in B.SILENCES: mix[int(round(a * SR)):int(round(b * SR))] = 0
    wavfile.write(OUT, SR, np.round(mix * 32767).astype(np.int16))

    # —— 自检 ——
    sr, y = wavfile.read(OUT); yf = y.astype(np.float64) / 32768
    print(f'\n文件 {OUT}\n  采样率 {sr} Hz · 声道 {y.shape[1]} · 样本 {len(y)} · 时长 {len(y) / sr:.6f} s')
    pk = [20 * np.log10(np.abs(yf[:, c]).max()) for c in range(2)]; tp = 20 * np.log10(B.tpeak(yf)); li = B.lufs(yf)
    print(f'  响度 {li:.2f} LUFS · 峰值 L {pk[0]:.2f} / R {pk[1]:.2f} dBFS · 真峰值 {tp:.2f} dBTP → {"OK ≤ −1.5" if max(max(pk), tp) <= -1.5 else "超了！"}'
          f' · 峰值/响度比 {tp - li:.1f} dB → {"mux 走 linear" if tp - li <= 12.8 else "mux 会走 dynamic！"}')
    for a, b in B.SILENCES:
        seg = y[int(round(a * SR)):int(round(b * SR))]
        print(f'  真静默 {a:.2f}–{b:.2f}: 非零样本 {int(np.count_nonzero(seg))} / {seg.size} → {"OK 全零" if not seg.any() else "有声音！"}')
    print('\n各段电平（RMS dBFS；总线电平已乘同一个输出增益，限幅前）；* = 干活段（配乐 − 拟音 用于对电平）')
    print(f'  {"时间":>13}  {"段落":<14}\t{"总":>7} {"配乐":>7} {"拟音":>7} {"环境":>7} {"嘶":>7} {"配乐−拟音":>9}')
    lv = {k: rows_db(bus[k] * gain) for k in ('mus', 'sfx', 'amb', 'hiss')}; tot = rows_db(yf); work = []
    for r, (a, b, lab) in enumerate(ROWS):
        d = lv['mus'][r] - lv['sfx'][r]
        if a in WORK: work.append(d)
        print(f'  {a:6.2f}–{b:6.2f}  {lab:<14}\t{tot[r]:7.1f} ' + ' '.join(f'{lv[k][r]:7.1f}' for k in ('mus', 'sfx', 'amb', 'hiss'))
              + f' {d:9.1f}' + (' *' if a in WORK else ''))
    print(f'\n干活段配乐 − 拟音：中位数 {np.median(work):+.1f} dB，范围 {min(work):+.1f} … {max(work):+.1f} dB（{len(work)} 段）')
    print('Music: "Chillax" by Francisco Alvear (Mixkit, Mixkit Stock Music Free License), 62.0–107.0 s')
