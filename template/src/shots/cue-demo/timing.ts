import {alignMotion, createCueSheet, motionProgress} from '../../common/motion/cues';

/** No guessed beats: replace arrivalSec with a verified narration/recording cue. */
export function createCueDemo(fps: number, holdSec = 1.2, arrivalSec = 1.4) {
  if (!Number.isFinite(holdSec) || holdSec < 0) throw new Error('holdSec must be nonnegative');
  const sheet = createCueSheet(fps, [
    {id: 'arrive', atSec: arrivalSec},
    {id: 'confirm', after: 'arrive', offsetSec: 0.25},
    {id: 'depart', after: 'confirm', offsetSec: holdSec},
    {id: 'finish', after: 'depart', offsetSec: 0.7},
  ]);
  const arrival = alignMotion(sheet.get('arrive').frame, 0.8 * fps);
  const departure = alignMotion(sheet.get('depart').frame, sheet.get('finish').frame - sheet.get('depart').frame, 0);
  const ease = (p: number) => p * p * (3 - 2 * p);
  return {sheet, arrival, departure, stateAt(frame: number) {
    const enter = ease(motionProgress(frame, arrival));
    const exit = ease(motionProgress(frame, departure));
    return {x: 190 + 570 * enter + 570 * exit,
      confirmed: frame >= sheet.get('confirm').frame,
      phase: frame < arrival.start ? 'READY' : frame < arrival.end ? 'APPROACH' : frame < departure.start ? 'RESULT / HOLD' : frame < departure.end ? 'HANDOFF' : 'COMPLETE'};
  }};
}
