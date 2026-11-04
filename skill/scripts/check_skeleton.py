#!/usr/bin/env python3
"""校验 skeleton.json 的时间算术。用法：python3 check_skeleton.py <skeleton.json>
位置一律写成 "小节:拍"（从 1 开始，拍可以是小数，如 "5:2.5"）；结束位置是开区间。
通过时打印每个镜头/字幕的秒数，失败时列出全部问题并以 1 退出。"""
import json, sys


def main(path):
    sk = json.load(open(path))
    spb = 60.0 / sk['bpm']                     # 每拍秒数
    bpb = sk['beatsPerBar']
    errs = []

    def sec(pos):
        bar, beat = (float(x) for x in pos.split(':'))
        return ((bar - 1) * bpb + (beat - 1)) * spb

    def on_bar(pos):
        return float(pos.split(':')[1]) == 1

    dur = sk['bars'] * bpb * spb
    if abs(dur - sk['dur']) > 1e-6:
        errs.append(f"小节算出的总长 {dur:.3f}s ≠ dur {sk['dur']}s")
    frames = dur * sk['fps']
    if abs(frames - round(frames)) > 1e-6:
        errs.append(f"总长 {dur:.3f}s 不是整数帧（{frames:.2f} 帧）")

    shots = sk['shots']
    t = 0.0
    for s in shots:
        a, b = sec(s['start']), sec(s['end'])
        if abs(a - t) > 1e-6:
            errs.append(f"{s['id']} 从 {a:.3f}s 开始，上一个镜头结束在 {t:.3f}s（{'重叠' if a < t else '留空'}）")
        if b <= a:
            errs.append(f"{s['id']} 结束不晚于开始")
        if sk.get('cutsOnBars') and not on_bar(s['start']) and not s.get('offBarOk'):
            errs.append(f"{s['id']} 的剪切 {s['start']} 不在小节线上（确属有意就加 \"offBarOk\": true 并写原因）")
        t = b
    if abs(t - dur) > 1e-6:
        errs.append(f"最后一个镜头结束在 {t:.3f}s，总长是 {dur:.3f}s")

    no_text = [(s['id'], sec(s['start']), sec(s['end'])) for s in shots if s.get('noText')]
    for m in sk.get('subs', []):
        a, b = sec(m['start']), sec(m['end'])
        need = max(1.8, len(m['text'].replace(' ', '')) / 4.5 + 1.5)
        if b - a < need - 1e-6:
            errs.append(f"字幕 {m['id']} 停留 {b - a:.2f}s，按字数至少要 {need:.2f}s")
        for sid, sa, sb in no_text:
            if a < sb and b > sa:
                errs.append(f"字幕 {m['id']}（{a:.2f}–{b:.2f}s）压在不放字的镜头 {sid}（{sa:.2f}–{sb:.2f}s）上")

    for x in sk.get('silences', []):
        if not (0 <= sec(x['start']) < sec(x['end']) <= dur):
            errs.append(f"静默 {x['start']}–{x['end']} 超出片长或首尾颠倒")
    for key in ('nativeMove', 'signature'):
        if key in sk and sk[key] not in {s['id'] for s in shots}:
            errs.append(f"{key} 指向不存在的镜头 {sk[key]}")

    for s in shots:
        print(f"{s['id']:>4}  {sec(s['start']):6.2f}–{sec(s['end']):6.2f}s  {s.get('framing', '')}")
    for m in sk.get('subs', []):
        print(f"{m['id']:>4}  {sec(m['start']):6.2f}–{sec(m['end']):6.2f}s  {m['text']}")
    if errs:
        print('\n✗ ' + '\n✗ '.join(errs))
        sys.exit(1)
    print(f'\n✓ 通过：{len(shots)} 个镜头，{len(sk.get("subs", []))} 条字幕，总长 {dur:.2f}s')


if __name__ == '__main__':
    main(sys.argv[1])
