/** Original illustrative game scenarios. Values are game rules, never measured claims. */
const freeze = value => { if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);} return value; };
export const SCENARIOS = freeze({
 lighthouse:{id:'lighthouse',name:'最后一盏灯',chapter:'01 / THE LAST LIGHT',goal:'让灯塔撑过这一场风暴',objective:'灯塔',objectiveArt:'lighthouse',maxIntegrity:3,energy:2,threat:{name:'风暴',art:'storm',power:3},theme:{table:'#0a3039',shadow:'#071c28',ink:'#172d37',paper:'#f0e0ba',gold:'#e4ba6c',accent:'#81dbcb',danger:'#ed866f'},choices:[
  {id:'brace',name:'加固',tag:'守住灯火',art:'anchor',cost:2,guard:3,reward:0},
  {id:'rush',name:'赶航',tag:'带回货物',art:'boat',cost:1,guard:0,reward:1}]},
 greenhouse:{id:'greenhouse',name:'种子守夜',chapter:'02 / THE SEED WATCH',goal:'让幼苗撑过这一夜寒潮',objective:'幼苗',objectiveArt:'seedling',maxIntegrity:2,energy:3,threat:{name:'寒潮',art:'frost',power:2},theme:{table:'#343d35',shadow:'#152b2a',ink:'#3f382c',paper:'#f1e5c8',gold:'#d8b777',accent:'#b1d897',danger:'#e28f6d'},choices:[
  {id:'warm',name:'暖房',tag:'护住新芽',art:'greenhouse',cost:2,guard:2,reward:0},
  {id:'harvest',name:'抢收',tag:'收回种子',art:'basket',cost:1,guard:0,reward:1}]}
});
export const DEFAULT_SCENARIO=SCENARIOS.lighthouse;
