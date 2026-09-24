import {AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Stage} from './Figure';
import {CYCLE, DURATION, REPETITIONS, cameraAt, teachingAt, timeline} from './motion';

export const SquatDemo = () => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const portrait = width < 1200;
  const time = timeline(frame), cue = teachingAt(frame);
  return <AbsoluteFill style={{backgroundColor: '#101116', color: '#f1f1f4', overflow: 'hidden'}}>
    <Interactive.Div name="Brand" style={{position: 'absolute', left: 90, top: 80, fontSize: 34, letterSpacing: '-1px', fontWeight: 600}}>FormFinder<span style={{color: '#97999f', fontWeight: 400}}> / movement study</span></Interactive.Div>
    <Interactive.Div name="Exercise title" style={{position: 'absolute', left: 90, top: 158, fontSize: portrait ? 88 : 78, lineHeight: 1.05, letterSpacing: '-3px', fontWeight: 600}}>Bodyweight squat</Interactive.Div>
    <div style={{position: 'absolute', left: portrait ? 80 : 850, top: portrait ? 280 : 115}}>
      <Stage frame={frame} portrait={portrait} />
      <div data-demo-view={cameraAt(frame).label} style={{position: 'absolute', left: 0, right: 0, top: portrait ? 0 : undefined, bottom: portrait ? undefined : 0, textAlign: 'center', fontSize: 22, letterSpacing: '3px', color: '#afb0b7'}}>{cameraAt(frame).label}</div>
    </div>
    <Interactive.Div name="Full-repetition teaching card" style={{position: 'absolute', left: 90, top: portrait ? 1270 : 340, width: portrait ? 880 : 720,
      opacity: interpolate(frame, [0, CYCLE - 10, CYCLE, CYCLE + 10, 2 * CYCLE - 10, 2 * CYCLE, 2 * CYCLE + 10, DURATION - 1], [1, 1, 0, 1, 1, 0, 1, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
      <Interactive.Div name="Instruction phase" style={{fontSize: 28, letterSpacing: '5px', color: '#afb0b7', fontWeight: 600}}>{cue.label}</Interactive.Div>
      <Interactive.Div name="Main instruction" style={{fontSize: portrait ? 92 : 88, fontWeight: 500, lineHeight: 1.06, letterSpacing: '-3px', whiteSpace: 'pre-line', marginTop: 28}}>{cue.title}</Interactive.Div>
      <Interactive.Div name="Supporting instruction" style={{fontSize: portrait ? 42 : 34, lineHeight: 1.45, color: '#b1b3bc', whiteSpace: 'pre-line', marginTop: 32}}>{cue.detail}</Interactive.Div>
    </Interactive.Div>
    <Interactive.Div name="Demo progress label" style={{position: 'absolute', left: 90, right: 90, bottom: portrait ? 178 : 155, display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#b9b8c3'}}>
      <span>DEMONSTRATION {String(time.repetition).padStart(2, '0')} / {String(REPETITIONS).padStart(2, '0')}</span><span>CONTROLLED PACE</span>
    </Interactive.Div>
    <div style={{position: 'absolute', left: 90, right: 90, bottom: portrait ? 150 : 125, height: 4, backgroundColor: '#32333c', borderRadius: 4}}>
      <Interactive.Div name="Demo timeline" style={{height: 4, borderRadius: 4, backgroundColor: '#9D8DF1', width: interpolate(frame, [0, DURATION - 1], ['0%', '100%'], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}} />
    </div>
    <Interactive.Div name="Review status" style={{position: 'absolute', left: 90, bottom: portrait ? 93 : 62, fontSize: portrait ? 26 : 24, color: '#989aa5'}}>PROTOTYPE · Technique review pending · Not a workout assessment</Interactive.Div>
  </AbsoluteFill>;
};
