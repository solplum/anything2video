import type {StyleSkin} from '../types';
/** Chrome support only: use styles/engraving/kit.tsx for the actual cut lines. */
export const ENGRAVING: StyleSkin = {
  id: 'engraving', name: '铜版雕刻', accentLegal: ['#6B492B'],
  palette: {
    accent: '#6B492B', accentLight: '#93704A', accentTech: '#6B492B', accentDeep: '#49301D', accentPale: '#E8DDC2',
    secondary: '#8C793D', secondaryAlt: '#A66E48', warning: '#A44832', correct: '#586C43',
    bg: '#F1E8D2', bgFog: '#F1E8D2', bgPanel: '#E8DDC2', grey: '#6D6252', greyMid: '#AB9C80', greyLine: '#C5B694', greyLight: '#1C1510',
    white: '#1C1510', magenta: '#A44832', cyan: '#586C63',
    glowAccent: 'none', glowAccentS: 'none', glowSecondary: 'none', glowWarning: 'none', accentGlowRgb: '107,73,43',
    haloDark: '#E8DDC2', haloLight: '#F1E8D2', techGlow: 'none', bloom: 'none', bloomSoft: 'none', textGlow: 'none', pillShadow: 'none', pillTextOnAccent: '#F1E8D2', textShadowOnSolid: 'none',
  },
  chrome: {subColor:'#1C1510', subStroke:'#F1E8D2', subAccent:'#6B492B', barFill:'#6B492B', barTrack:'rgba(107,73,43,0.18)', barLabel:'#6D6252', barDivider:'#AB9C80', barHair:'#6B492B', barLabelActive:'#1C1510', barGlow:false, endFade:'#F1E8D2'},
};
