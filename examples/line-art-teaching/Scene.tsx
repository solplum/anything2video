import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import {Annot, CornerNote, ForceFill, LABackdrop, LoadArrow, OneStroke, PenTip, T, TitleCard} from './style/kit';
import {TeachingLabel, TeachingNote, TeachingPrompt} from './style/teaching';

/** Reconstructed control, not a pixel-identical copy of the historical released sample. */
export const Scene: React.FC<{teaching: boolean}> = ({teaching}) => {
  const N = useCurrentFrame() + 1;
  const [fontHandle] = useState(() => delayRender('Load bundled line-art fonts'));
  useEffect(() => {
    let mounted = true;
    Promise.all([
      new FontFace('Noto Sans SC', `url(${staticFile('fonts/NotoSansSC.ttf')})`, {weight: '100 900'}).load(),
      new FontFace('Noto Serif SC', `url(${staticFile('fonts/NotoSerifSC.ttf')})`, {weight: '200 900'}).load(),
    ]).then(fonts => {
      fonts.forEach(font => (document.fonts as FontFaceSet & {add(font: FontFace): FontFaceSet}).add(font));
      if (mounted) continueRender(fontHandle);
    }).catch(error => cancelRender(error));
    return () => {mounted = false;};
  }, [fontHandle]);
  return <AbsoluteFill>
    <LABackdrop />
    <OneStroke N={N} />
    <ForceFill N={teaching ? Math.min(N, T.fill[1]) : N} />
    <LoadArrow N={N} />
    <PenTip N={N} />
    {teaching ? <>
      <TeachingPrompt N={N} from={1} until={T.arrowShaft[0] - 6} text="桥上的重量，由谁承担？" />
      <TeachingLabel N={N} from={T.labelLoad} x={520} y={292} text="荷载" leader={[[608, 286], [640, 318]]} />
      <TeachingLabel N={N} from={T.labelCable} x={470} y={220} text="拉索" leader={[[565, 225], [730, 313]]} />
      <TeachingPrompt N={N} from={337} text="沿拉索，把力传给桥塔" />
      <TeachingNote N={N} from={T.labelNote} text="受力示意 · 非精确比例" />
    </> : <>
      <Annot N={N} from={T.labelLoad} x={665} y={325} text="荷载" leader={[[660, 330], [643, 340]]} />
      <Annot N={N} from={T.labelCable} x={552} y={500} text="索力" anchor="middle" leader={[[552, 485], [552, 472]]} />
      <CornerNote N={N} />
      <TitleCard N={N} />
    </>}
    <Audio src={staticFile('source-audio.m4a')} />
  </AbsoluteFill>;
};
