// 15 秒风格样片：开场提问 → 初版片段 + 圈出问题 → 第一版 | 第六版并排
import React from 'react';
import {OffthreadVideo, Sequence, staticFile} from 'remotion';
import {Callout, Fade, Keyword, Label, Screen, Stage} from './stage';

const BIG = {x: 320, y: 100, w: 1280};          // 单屏：1280×720
const L = {x: 120, y: 230, w: 820}, R = {x: 980, y: 230, w: 820};  // 双屏：各 820×461

const Clip: React.FC<{src: string; rate?: number}> = ({src, rate = 1}) => (
  <OffthreadVideo src={staticFile(src)} playbackRate={rate} muted style={{width: '100%', height: '100%'}} />
);

export const StyleTest: React.FC = () => (
  <Stage>
    <Sequence from={0} durationInFrames={96}>
      <Fade dur={96}>
        <Screen {...BIG} appear={0}><Clip src="c_open.mp4" /></Screen>
        <Keyword text="一句话能生成动画吗？" appear={14} />
      </Fade>
    </Sequence>
    <Sequence from={96} durationInFrames={144}>
      <Fade dur={144}>
        <Screen {...BIG} appear={0}><Clip src="c_v1s4.mp4" rate={0.5} /></Screen>
        <Label text="第一版" x={BIG.x} y={36} w={BIG.w} appear={4} />
        {/* 源画面里擀面杖滚到面片下沿、手按在台面上（约 11–12 s），换算到屏幕坐标 */}
        <Callout cx={960} cy={590} rx={330} ry={95} appear={88} />
        <Keyword text="擀面杖滚到了桌上" appear={92} />
      </Fade>
    </Sequence>
    <Sequence from={240} durationInFrames={120}>
      <Fade dur={120}>
        <Label text="第一版" x={L.x} y={L.y - 70} w={L.w} appear={2} />
        <Label text="第六版" x={R.x} y={R.y - 70} w={R.w} hi appear={2} />
        <Screen {...L} appear={0}><Clip src="c_v1s4.mp4" /></Screen>
        <Screen {...R} appear={4}><Clip src="c_v6s4.mp4" /></Screen>
        <Keyword text="三渲二：杖真的压着面" y={800} appear={20} />
      </Fade>
    </Sequence>
  </Stage>
);
