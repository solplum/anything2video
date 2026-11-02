import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {CharacterActionDemo} from '../../template/src/shots/character-action/Demo';
import baseline from './storyboard.json';
import lateContact from './storyboard.late-contact.json';
import project from './project.json';
const contactSec=(plan:typeof baseline)=>(plan.shots[0].story.actions[0].phases.contact[0]-1)/project.fps;
const Root=()=> <><Composition id="CharacterAction" component={CharacterActionDemo} durationInFrames={240} fps={30} width={1280} height={720} defaultProps={{contactSec:contactSec(baseline)}}/><Composition id="CharacterActionLateContact" component={CharacterActionDemo} durationInFrames={240} fps={30} width={1280} height={720} defaultProps={{contactSec:contactSec(lateContact)}}/></>;
registerRoot(Root);
