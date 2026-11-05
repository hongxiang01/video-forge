import React from 'react';
import {Composition} from 'remotion';
import {StyleTest} from './StyleTest';
import {Explainer, EXPLAINER_FRAMES} from './Explainer';

export const Root: React.FC = () => (
  <>
    <Composition id="StyleTest" component={StyleTest} durationInFrames={360} fps={24} width={1920} height={1080} />
    <Composition id="Explainer" component={Explainer} durationInFrames={EXPLAINER_FRAMES} fps={24} width={1920} height={1080} />
  </>
);
