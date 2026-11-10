/** Original, deterministic lighttable scene. No external images, clock or random source. */
export const TOKENS = Object.freeze({room: '#101b25', frame: '#293f4c', light: '#edf7f8', grid: '#b9d2d8', paper: '#f0ebdb', ink: '#253f47', muted: '#637a7b', red: '#c54036', yellow: '#f1d769'});
export const DURATION_SECONDS = 12;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const mix = (a, b, p) => a + (b - a) * p;
const n = v => Number(v.toFixed(3));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

export function layoutFor(width, height) {
  if (![width, height].every(v => Number.isFinite(v) && v > 0)) throw new TypeError('width and height must be positive finite numbers');
  const portrait = height > width;
  return portrait
    ? {portrait, w:720, h:1280, page:{x:80,y:285,w:560,h:465}, tag:{x:94,y:834,w:405,h:190}, lensA:{x:246,y:671}, lensB:{x:275,y:929}, radius:112, footY:1150}
    : {portrait, w:1280, h:720, page:{x:145,y:186,w:560,h:405}, tag:{x:815,y:257,w:320,h:192}, lensA:{x:311,y:512}, lensB:{x:968,y:352}, radius:110, footY:644};
}

export function stateAt(frame, fps, width = 1280, height = 720) {
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0) throw new TypeError('frame must be finite and fps must be positive');
  const t = clamp(frame / fps, 0, DURATION_SECONDS);
  const layout = layoutFor(width,height);
  const travel = ease((t - 4.9) / 1.0);
  const exit = ease((t - 9.2) / 0.65);
  return {t, layout, reveal: ease(t / 1.2), lensOpacity: ease((t - 1.35) / 0.5) * (1-exit),
    lens:{x:mix(layout.lensA.x,layout.lensB.x,travel) + exit * (layout.portrait ? 150 : 45), y:mix(layout.lensA.y,layout.lensB.y,travel) - exit * (layout.portrait ? 120 : 105)},
    markA: ease((t - 3.25) / 0.65), markB: ease((t - 7.0) / 0.65), conclusion: ease((t - 9.05) / 0.6), stage:t<4.9?0:t<9.05?1:2};
}

function text(x,y,value,size=18,attrs='') { return `<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${esc(value)}</text>`; }
function leaf(x,y,scale=1) {
  // An original geometric specimen, not a botanical identification or scanned archive.
  let veins='';
  for(let i=0;i<12;i++) {
    const a=-2.88+i*0.235, ex=90*Math.cos(a), ey=-7+90*Math.sin(a);
    veins+=`<path d="M 0 55 Q ${n(ex*.27)} ${n(ey*.3)} ${n(ex)} ${n(ey)}"/>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M 0 61 C -9 83 -15 104 -19 123" fill="none" stroke="#63745f" stroke-width="4"/><path d="M 0 60 C -34 25 -93 31 -116 -34 L -110 -49 -113 -63 -100 -70 -98 -83 -82 -84 -75 -98 -61 -97 -49 -109 -33 -103 -18 -111 -4 -100 3 -81 13 -104 30 -110 42 -98 59 -103 71 -89 85 -89 91 -73 107 -68 108 -53 117 -43 C 104 12 41 28 0 60 Z" fill="#9ca47c" stroke="#596f62" stroke-width="2.3"/><g fill="none" stroke="#536e60" stroke-width="1.2" opacity=".68">${veins}</g></g>`;
}

function archive(layout,id) {
  const p=layout.page, tag=layout.tag;
  const py = layout.portrait ? 120 : 90;
  const bodyY = layout.portrait ? 205 : 175;
  let ruled='';
  for(let i=0;i<4;i++) ruled+=`<path d="M ${p.x+353} ${p.y+bodyY+i*35} h 157" stroke="#b7bca8" stroke-width="1"/>`;
  return `<g id="${id}-original">
    <g filter="url(#${id}-paper-shadow)">
      <path d="M ${p.x} ${p.y} L ${p.x+p.w-14} ${p.y-5} L ${p.x+p.w+3} ${p.y+p.h-8} L ${p.x+4} ${p.y+p.h+3} Z" fill="${TOKENS.paper}"/>
      <path d="M ${p.x+7} ${p.y+9} H ${p.x+p.w-14} V ${p.y+p.h-9} H ${p.x+11} Z" fill="url(#${id}-fibres)"/>
      <path d="M ${p.x+p.w-36} ${p.y-4} l 21 0 1 31" fill="none" stroke="#b7b19f"/>
    </g>
    <g fill="${TOKENS.ink}">
      ${text(p.x+29,p.y+38,'FIELD NOTES / 2026',14,'letter-spacing="2.4" font-family="monospace"')}
      ${text(p.x+29,p.y+79,'城市叶片观察',31,'font-weight="600" font-family="Noto Serif CJK SC,serif"')}
      ${text(p.x+p.w-28,p.y+38,'样本 / 01',15,'text-anchor="end"')}
      <path d="M ${p.x+29} ${p.y+97} H ${p.x+p.w-29}" stroke="#8b9c91"/>
      ${leaf(p.x+174,p.y+bodyY+30,layout.portrait?1.0:.82)}
      <path d="M ${p.x+62} ${p.y+py+40} l 21 -5 M ${p.x+272} ${p.y+py+38} l 22 5" stroke="#b9af80" stroke-width="12" opacity=".65"/>
      ${text(p.x+353,p.y+bodyY-12,'观察记录',17,'font-weight="600"')}
      ${ruled}
      ${text(p.x+353,p.y+bodyY+24,'扇形叶片',19)}
      ${text(p.x+353,p.y+bodyY+59,'浅裂边缘',19)}
      ${text(p.x+353,p.y+bodyY+94,'原件保留',19)}
      ${text(p.x+30,p.y+p.h-62,'标本编号',16,'letter-spacing="1"')}
      ${text(layout.lensA.x,layout.lensA.y+10,'A–042',33,'font-family="monospace" font-weight="700" text-anchor="middle"')}
      <path d="M ${p.x+28} ${p.y+p.h-35} H ${p.x+p.w-28}" stroke="#a6ad9d"/>
      ${text(p.x+29,p.y+p.h-13,'示意档案 · 原创图形 · 非真实采集数据',12,'fill="#6a7d70"')}
    </g>
    <g filter="url(#${id}-paper-shadow)">
      <path d="M ${tag.x} ${tag.y} h ${tag.w} v ${tag.h} h -${tag.w} Z" fill="#e4eadf"/>
      <rect x="${tag.x}" y="${tag.y}" width="${tag.w}" height="35" fill="#d0dcd2"/>
    </g>
    <g fill="${TOKENS.ink}">
      ${text(tag.x+20,tag.y+24,'CATALOG CARD / B',14,'font-family="monospace" letter-spacing="1"')}
      ${text(tag.x+20,tag.y+63,'索引编号',17)}
      ${text(layout.lensB.x,layout.lensB.y+10,'A–047',33,'font-family="monospace" font-weight="700" text-anchor="middle"')}
      <path d="M ${tag.x+20} ${tag.y+124} h ${tag.w-40}" stroke="#a6b6aa"/>
      ${text(tag.x+20,tag.y+153,'与原件逐项核对',18)}
      ${text(tag.x+20,tag.y+177,'COPY / 待复核',12,'font-family="monospace" letter-spacing="1"')}
    </g>
  </g>`;
}

function filmStrip(layout) {
  const x=layout.portrait?523:802, y=layout.portrait?805:487, vertical=layout.portrait;
  let shots='';
  for(let i=0;i<3;i++) {
    const sx=vertical?x:x+i*112, sy=vertical?y+i*78:y;
    shots+=`<g transform="translate(${sx} ${sy})"><rect width="100" height="70" fill="#344c52"/>${leaf(51,35,.22)}<text x="7" y="63" font-size="9" fill="#b5c6c0" font-family="monospace">0${i+1} / CONTACT</text></g>`;
  }
  return `<g opacity=".9">${shots}</g>`;
}

function redMark(point,progress,rx=76,ry=28) {
  const length=Math.PI*(3*(rx+ry)-Math.sqrt((3*rx+ry)*(rx+3*ry)));
  return `<ellipse cx="${point.x}" cy="${point.y}" rx="${rx}" ry="${ry}" fill="none" stroke="${TOKENS.red}" stroke-width="3.8" stroke-linecap="round" stroke-dasharray="${n(length)} ${n(length)}" stroke-dashoffset="${n(length*(1-progress))}" opacity="${progress>0?1:0}" transform="rotate(-5 ${point.x} ${point.y})"/>`;
}

export function renderLighttable({frame=0,fps=30,width=1280,height=720,idPrefix='lighttable'}={}) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(idPrefix)) throw new TypeError('idPrefix must be a safe SVG identifier');
  const s=stateAt(frame,fps,width,height), l=s.layout, {w,h}=l, id=idPrefix;
  const cx=n(s.lens.x),cy=n(s.lens.y),r=l.radius, zoom=1.8;
  const phases=['01 / 查看原件','02 / 放大对照','03 / 标记差异'];
  const slide=n((1-s.reveal)*28), lensEnter=n((1-s.lensOpacity)*95);
  const headings=l.portrait ? [text(62,124,'同一份档案，',41,'font-family="Noto Serif CJK SC,serif" font-weight="600"'),text(62,180,'两个编号。',41,'font-family="Noto Serif CJK SC,serif" font-weight="600"')].join('') : text(82,126,'同一份档案，两个编号。',42,'font-family="Noto Serif CJK SC,serif" font-weight="600"');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}" role="img" aria-label="档案灯台：放大原件与索引，红笔标记不同编号">
  <defs>
    <radialGradient id="${id}-light"><stop stop-color="#fbffff"/><stop offset=".76" stop-color="#e7f2f3"/><stop offset="1" stop-color="#c8dde1"/></radialGradient>
    <linearGradient id="${id}-rim" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#b1c4ca"/><stop offset=".25" stop-color="#405660"/><stop offset=".65" stop-color="#152c36"/><stop offset="1" stop-color="#8ca4ac"/></linearGradient>
    <pattern id="${id}-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 H 0 V 32" fill="none" stroke="${TOKENS.grid}" stroke-width=".7"/></pattern>
    <pattern id="${id}-fibres" width="13" height="17" patternUnits="userSpaceOnUse"><path d="M 2 4 l 2 -.4 M 9 11 l 1.5 .2" stroke="#a6a58d" stroke-width=".55" opacity=".19"/></pattern>
    <filter id="${id}-paper-shadow" x="-20%" y="-20%" width="150%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="5"/><feOffset dx="3" dy="6"/><feComponentTransfer><feFuncA type="linear" slope=".22"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="${id}-lens-shadow" x="-60%" y="-60%" width="220%" height="230%"><feGaussianBlur in="SourceAlpha" stdDeviation="8"/><feOffset dx="8" dy="13"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="${id}-lens-clip"><circle cx="${cx}" cy="${cy}" r="${r-10}"/></clipPath>
  </defs>
  <rect width="${w}" height="${h}" fill="${TOKENS.room}"/>
  <rect x="17" y="17" width="${w-34}" height="${h-34}" rx="16" fill="${TOKENS.frame}" stroke="#596f79" stroke-width="1"/>
  <rect x="31" y="31" width="${w-62}" height="${h-62}" rx="9" fill="url(#${id}-light)"/>
  <rect x="31" y="31" width="${w-62}" height="${h-62}" rx="9" fill="url(#${id}-grid)" opacity=".65"/>
  <g fill="${TOKENS.ink}" font-family="Noto Sans CJK SC,sans-serif">
    ${text(l.portrait?62:82,72,'档案灯台 / LIGHTTABLE',15,'letter-spacing="3" font-family="monospace"')}
    ${headings}
    ${text(l.portrait?62:w-82,l.portrait?225:79,phases[s.stage],17,`text-anchor="${l.portrait?'start':'end'}" fill="#577079"`)}
    ${!l.portrait?text(w-82,112,'VISUAL STUDY / 12s',12,'text-anchor="end" font-family="monospace" letter-spacing="2"'):''}
    <g transform="translate(0 ${slide})" opacity="${n(s.reveal)}">
      <g id="${id}-evidence">${archive(l,id)}
      ${redMark(l.lensA,s.markA)}${redMark(l.lensB,s.markB)}</g>
      ${filmStrip(l)}
    </g>
    <g opacity="${n(s.lensOpacity)}" transform="translate(${lensEnter} 0)">
      <g filter="url(#${id}-lens-shadow)"><path d="M ${cx+r*.7} ${cy+r*.7} l ${l.portrait?65:78} ${l.portrait?65:78}" stroke="#172d35" stroke-width="25" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-rim)"/></g>
      <g clip-path="url(#${id}-lens-clip)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${TOKENS.light}"/>
        <g transform="translate(${cx} ${cy}) scale(${zoom}) translate(${-cx} ${-cy})"><use href="#${id}-evidence" xlink:href="#${id}-evidence"/></g>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="#9edee5" fill-opacity=".06"/>
      </g>
      <circle cx="${cx}" cy="${cy}" r="${r-9}" fill="none" stroke="#c1d4d5" stroke-width="2"/>
      <path d="M ${cx-r*.68} ${cy-r*.39} A ${r*.78} ${r*.78} 0 0 1 ${cx-r*.22} ${cy-r*.76}" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" opacity=".72"/>
      ${text(cx,cy-r-20,'× 1.8',13,'text-anchor="middle" font-family="monospace" fill="#4c646d"')}
    </g>
    <g opacity="${n(s.conclusion)}" transform="translate(0 ${n((1-s.conclusion)*9)})">
      <path d="M ${l.lensA.x+70} ${l.lensA.y+38} ${l.portrait?`L 431 790 L 350 847`:`Q 705 596 935 394`}" fill="none" stroke="${TOKENS.red}" stroke-width="2" stroke-dasharray="4 5"/>
      <rect x="${l.portrait?66:82}" y="${l.footY-30}" width="${l.portrait?588:1116}" height="48" rx="2" fill="${TOKENS.yellow}"/>
      ${text(l.portrait?87:104,l.footY+1,'先核对原件，再下结论。',l.portrait?26:25,'font-weight="600"')}
      ${!l.portrait?text(1175,l.footY-1,'差异已标记 / REVIEW',13,'text-anchor="end" font-family="monospace"'):''}
    </g>
    ${text(l.portrait?62:82,h-49,'无声风格研究 · 档案与内容均为原创示意',12,'fill="#617d83"')}
    ${text(w-62,h-49,'A2V / 001',12,'text-anchor="end" font-family="monospace" fill="#617d83"')}
  </g></svg>`;
}
