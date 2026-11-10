#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const src=fs.readFileSync(path.join(import.meta.dirname,'../../styles/choice-quest/scene.mjs'),'utf8').replace(/^export /gm,'');
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>选项冒险 · 原创样片</title><style>
*{box-sizing:border-box}body{margin:0;background:#10252a;color:#f0e5c7;font:16px/1.6 system-ui,sans-serif;padding:24px}main{max-width:1280px;margin:auto}h1{font-size:24px;margin:0}p{color:#a4bab1}#stage{aspect-ratio:16/9;width:100%;background:#14272c}#stage svg{display:block;width:100%;height:100%}.controls{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:20px}button,select,input{font:inherit}button,select{background:#24434a;color:#f0e5c7;border:1px solid #6c8985;padding:8px 14px;border-radius:4px;cursor:pointer}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #e9bb65;outline-offset:3px}#seek{flex:1;min-width:220px}label{display:flex;gap:8px;align-items:center}.note{font-size:14px;max-width:960px}
</style><main><h1>选项冒险 · 雾谷驿站</h1><p>场景、选项、动作与后果。不是换一个像素色板。</p><div id="stage"></div><div class="controls"><button id="play">播放</button><button id="restart">从头播放</button><label>分支 <select id="branch"><option value="repair">给桥供电</option><option value="wait">保留电芯</option></select></label><label><input type="checkbox" id="captions" checked>对话字幕</label><label><input type="checkbox" id="late">选择延后 0.5 秒</label><input type="range" id="seek" min="0" max="539" value="0" aria-label="逐帧定位"><output id="time"></output></div><p class="note">18 秒无声视觉原型。分支按钮用于预先选择演示路线，不表示成片本身可交互。页面直接运行与视频相同的 SVG 场景源码。MP4 使用系统 SVG 栅格器生成；原生 Remotion / Chromium 渲染、连续播放与完整终检尚未通过。</p></main><script type="module">
${src}
const $=id=>document.getElementById(id);let frame=0,playing=false,start=0;
function draw(){const late=$('late').checked;const state=questState({frame,branch:$('branch').value,selectSec:late?7:6.5});$('stage').innerHTML=renderQuest({frame,branch:$('branch').value,showCaptions:$('captions').checked,selectSec:late?7:6.5});$('seek').value=frame;$('time').textContent=(frame/30).toFixed(2)+' / 18.00 s';$('play').textContent=playing?'暂停':'播放';}
function tick(now){if(playing){frame=Math.min(539,Math.floor((now-start)/1000*30));if(frame===539)playing=false;draw()}requestAnimationFrame(tick)}
$('play').onclick=()=>{if(frame===539)frame=0;playing=!playing;start=performance.now()-frame/30*1000;draw()};
$('restart').onclick=()=>{frame=0;playing=true;start=performance.now();draw()};
$('seek').oninput=()=>{playing=false;frame=Number($('seek').value);draw()};
for(const id of ['branch','captions','late'])$(id).onchange=()=>{playing=false;draw()};
document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;draw()}});draw();requestAnimationFrame(tick);
</script></html>`;
fs.writeFileSync(path.join(import.meta.dirname,'preview.html'),html);
console.log('Standalone preview generated from exact scene.mjs');
