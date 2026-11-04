import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {Fonts} from '../common/lib';
import {CHAPTER_STARTS, TOTAL_FRAMES, SENTENCES} from '../common/timeline';
import {P, FONT, at, prog, clamp01} from './kit';
import {SHOTS} from './shots';

// 镜头窗口：从首句 from−12 开始，到下一镜头开始为止；首尾各 FADE 帧（先淡出到纸面，再淡入下一镜，不交叠 → 无双影）。
// 第一个镜头从第 0 帧开始且不淡入（开场第 0 帧就有完整画面）。
export const WINDOWS = SHOTS.map((s, i) => {
  const start = i === 0 ? 0 : Math.max(0, at(s.first).from - 12);
  const next = SHOTS[i + 1];
  const end = next ? at(next.first).from - 12 : TOTAL_FRAMES;
  return {...s, start, end};
});

const FADE = 8;

// 配乐：无人声时 0.24，人声段压到 0.12（约 −6dB），前后 6 帧过渡
const musicVol = (fr: number) => {
  let near = 99;
  for (const s of SENTENCES) {
    const a = s.from - 1, b = s.to - 1;
    const d = fr < a ? a - fr : fr > b ? fr - b : 0;
    if (d < near) near = d;
    if (near === 0) break;
  }
  const k = clamp01(near / 6);
  return 0.12 + 0.12 * k;
};

const ChapterCard: React.FC<{f: number}> = ({f}) => {
  // 章前空白约 45 帧：卡片占住这段空白，章首句开口前 10 帧开始退场，不压住下一章画面
  const ch = CHAPTER_STARTS.find((c) => f >= c.from - 1 - 48 && f <= c.from - 1 + 2);
  if (!ch || ch.n === 1) return null;
  const t0 = ch.from - 1 - 48;
  const op = Math.min(prog(f, t0, 6), 1 - clamp01((f - (ch.from - 1 - 10)) / 12));
  return (
    <AbsoluteFill style={{background: P.bg, opacity: op, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{fontFamily: FONT, color: P.accent, fontSize: 40, fontWeight: 800, letterSpacing: 6}}>0{ch.n}</div>
      <div style={{fontFamily: FONT, color: P.ink, fontSize: 92, fontWeight: 900, marginTop: 10}}>{ch.title}</div>
    </AbsoluteFill>
  );
};

const TopBar: React.FC<{f: number}> = ({f}) => {
  const n = CHAPTER_STARTS.length;
  const cur = [...CHAPTER_STARTS].reverse().find((c) => f >= c.from - 1) ?? CHAPTER_STARTS[0];
  return (
    <>
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, background: `linear-gradient(to bottom, rgba(242,236,224,0), ${P.bg} 45%)`}} />
    <div style={{position: 'absolute', left: 60, right: 60, bottom: 30, display: 'flex', gap: 14, opacity: 0.9}}>
      {CHAPTER_STARTS.map((c, i) => {
        const s = c.from - 1;
        const e = i + 1 < n ? CHAPTER_STARTS[i + 1].from - 1 : TOTAL_FRAMES;
        const p = clamp01((f - s) / (e - s));
        const active = c.n === cur.n;
        return (
          <div key={c.n} style={{flex: 1}}>
            <div style={{height: 6, background: P.soft, borderRadius: 3, overflow: 'hidden'}}>
              <div style={{width: `${p * 100}%`, height: '100%', background: active ? P.accent : P.mid}} />
            </div>
            <div style={{fontFamily: FONT, fontSize: 28, fontWeight: 700, color: active ? P.ink : P.mid, marginTop: 8}}>{c.title}</div>
          </div>
        );
      })}
    </div>
    </>
  );
};

export const Film: React.FC<{audio?: boolean}> = ({audio = true}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: P.bg}}>
      <Fonts />
      {audio ? <Audio src={staticFile('assets/ai-howto/audio.wav')} /> : null}
      {audio ? <Audio src={staticFile('assets/ai-howto/music.wav')} volume={(fr) => musicVol(fr)} /> : null}
      {WINDOWS.filter((w) => f >= w.start && f < w.end).map((w) => {
        const fin = w.start === 0 ? 1 : clamp01((f - w.start) / FADE);
        const op = Math.min(fin, clamp01((w.end - f) / FADE));
        return (
          <AbsoluteFill key={w.id} style={{opacity: op}}>
            <w.Comp />
          </AbsoluteFill>
        );
      })}
      <ChapterCard f={f} />
      <TopBar f={f} />
    </AbsoluteFill>
  );
};
