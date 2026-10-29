import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { auditReadability } from '../scripts/probe_readability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('recipes/documentary.md exists with authentic archival clearance and rostrum rules', () => {
  const docPath = path.join(root, 'recipes', 'documentary.md');
  assert.ok(fs.existsSync(docPath), 'recipes/documentary.md must exist');
  const content = fs.readFileSync(docPath, 'utf8');

  assert.ok(content.includes('documentary') && content.includes('纪录片'), 'Must describe documentary recipe');
  assert.ok(content.includes('research/archival-rights.json'), 'Must require archival-rights.json');
  assert.ok(content.includes('Public Domain') || content.includes('公有领域'), 'Must specify Public Domain / CC licenses');
  assert.ok(content.includes('RostrumStage'), 'Must specify RostrumStage component');
  assert.ok(content.includes('存证') || content.includes('印鉴'), 'Must specify provenance cartouche or seal');
});

test('RostrumStage component is implemented and exported in kit', () => {
  const compPath = path.join(root, 'template', 'src', 'common', 'kit', 'RostrumStage.tsx');
  assert.ok(fs.existsSync(compPath), 'RostrumStage.tsx must exist');
  const compContent = fs.readFileSync(compPath, 'utf8');

  assert.ok(compContent.includes('export const RostrumStage'), 'Must export RostrumStage component');
  assert.ok(compContent.includes('RostrumStageProps'), 'Must declare RostrumStageProps interface');
  assert.ok(compContent.includes('vignette'), 'Must support optical vignette');
  assert.ok(compContent.includes('stamp') || compContent.includes('highlight'), 'Must support seal or stamp highlight');
  assert.ok(compContent.includes('Provenance') || compContent.includes('存证'), 'Must support provenance cartouche');

  const kitIndexPath = path.join(root, 'template', 'src', 'common', 'kit', 'index.ts');
  const kitIndex = fs.readFileSync(kitIndexPath, 'utf8');
  assert.ok(kitIndex.includes('RostrumStage'), 'Kit index must export RostrumStage');
});

test('probe_readability.mjs correctly audits mobile scale and subtitle safezone', () => {
  // Test 1: Full HD 1080x1920 image with safe text
  const res1 = auditReadability({
    width: 1080,
    height: 1920,
    mobileWidth: 480,
    safeBottom: 170,
    elements: [
      { text: '历史的转折点', fontSize: 52, y: 1450, height: 60 },
      { text: '正文解释说明', fontSize: 44, y: 600, height: 50 },
    ],
  });

  assert.equal(res1.status, 'passed');
  assert.equal(res1.mobileWidth, 480);
  assert.equal(res1.mobileHeight, 853);
  assert.equal(res1.safezoneViolations.length, 0);
  assert.equal(res1.unreadables.length, 0);

  // Test 2: Subtitle entering bottom safezone (e.g. y = 1800 in 1920 height, inside bottom 170px zone [1750..1920])
  const res2 = auditReadability({
    width: 1080,
    height: 1920,
    mobileWidth: 480,
    safeBottom: 170,
    elements: [
      { text: '危险的贴底文字', fontSize: 48, y: 1780, height: 50 },
    ],
  });

  assert.equal(res2.status, 'failed');
  assert.equal(res2.safezoneViolations.length, 1);
  assert.ok(res2.safezoneViolations[0].bottom > (1920 - 170));

  // Test 3: Micro font size below minimum readable threshold on 480px mobile screen (< 18px equivalent)
  const res3 = auditReadability({
    width: 1080,
    height: 1920,
    mobileWidth: 480,
    safeBottom: 170,
    elements: [
      { text: '极小微缩文字', fontSize: 16, y: 500, height: 20 },
    ],
  });

  assert.equal(res3.status, 'failed');
  assert.equal(res3.unreadables.length, 1);
  assert.ok(res3.unreadables[0].scaledFontSize < 12);
});

test('export_jianying.py exports validated experimental draft data without asserting desktop compatibility', async () => {
  const {createHash} = await import('node:crypto');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-jianying-test-'));
  const projectDir = path.join(tmpDir, 'mock-project');
  const outDir = path.join(tmpDir, 'jianying-draft-out');
  try {
    const audioDir = path.join(projectDir, 'public/assets/mock-doc');
    for (const dir of ['script', 'renders', 'public/assets/mock-doc']) {
      fs.mkdirSync(path.join(projectDir, dir), {recursive: true});
    }
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      slug: 'mock-doc', width: 64, height: 64, fps: 30, totalFrames: 60,
    }));
    fs.writeFileSync(path.join(projectDir, 'script/timeline.json'), JSON.stringify({
      fps: 30, total_frames: 60,
      sentences: [{from: 1, to: 60, text: '完整句子', subs: [
        {from: 1, to: 30, text: '首块字幕'}, {from: 31, to: 60, text: '尾块字幕'},
      ]}],
    }));
    // Real media, not magic RIFF bytes renamed .mp4. Proves producer-side FFprobe checks only.
    const movie = path.join(projectDir, 'renders/mock-doc_v1.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=30:d=2',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '2', '-c:v', 'libx264',
      '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', movie]);
    execFileSync('ffmpeg', ['-v', 'error', '-i', movie, '-vn', '-c:a', 'pcm_s16le',
      path.join(audioDir, 'audio_narration.wav')]);
    fs.writeFileSync(movie + '.delivery.json', JSON.stringify({
      schemaVersion: 1, mode: 'video', frames: {from: 1, to: 60},
      mediaSha256: createHash('sha256').update(fs.readFileSync(movie)).digest('hex'),
    }));
    // The alphabetically earlier preview must never replace the full-render candidate.
    const preview = path.join(projectDir, 'renders/mock-doc_preview.mp4');
    fs.copyFileSync(movie, preview);
    fs.writeFileSync(preview + '.delivery.json', JSON.stringify({schemaVersion: 1, mode: 'preview'}));
    const scriptPath = path.join(root, 'scripts/export_jianying.py');
    execFileSync('python3', [scriptPath, projectDir, '--out', outDir, '--dry-run', '--include-subtitles']);
    assert.ok(!fs.existsSync(outDir), 'dry-run must not create output or copy media');
    const pyOutput = execFileSync('python3', [scriptPath, projectDir, '--out', outDir, '--include-subtitles'], {encoding: 'utf8'});
    assert.ok(pyOutput.includes('实验性 Jianying draft'));
    const draftDir = path.join(outDir, 'mock-project');
    const data = JSON.parse(fs.readFileSync(path.join(draftDir, 'draft_info.json'), 'utf8'));
    assert.deepEqual(data.tracks.map(t => t.type), ['video', 'audio', 'text']);
    assert.ok(data.materials.videos[0].path.endsWith('mock-doc_v1.mp4'));
    assert.ok(data.materials.audios[0].path.endsWith('audio_narration.wav'));
    assert.equal(data.tracks[0].segments[0].volume, 1, 'Rendered master audio remains authoritative');
    assert.equal(data.tracks[1].segments[0].volume, 0, 'Editable raw stem must not double the mix');
    assert.deepEqual(data.tracks[2].segments.map(s => s.target_timerange), [
      {start: 0, duration: 1000000}, {start: 1000000, duration: 1000000},
    ]);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(draftDir, 'draft_content.json'), 'utf8')), data);
  } finally {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  }
});

test('directing playbook and production contract incorporate v5.0.0 rules', () => {
  const playbook = fs.readFileSync(path.join(root, 'reference', 'directing-playbook.md'), 'utf8');
  assert.ok(playbook.includes('动效四段律'), 'Playbook must define 4-phase motion protocol');
  assert.ok(playbook.includes('独有介质动作法则'), 'Playbook must define One Native Move rule');
  assert.ok(playbook.includes('时长最大值闭合定理'), 'Playbook must define Timing Max Theorem');

  const contract = fs.readFileSync(path.join(root, 'reference', 'production-contract.md'), 'utf8');
  assert.ok(contract.includes('documentary'), 'Contract must support documentary recipe');
  assert.ok(contract.includes('research/archival-rights.json'), 'Contract must require archival-rights.json');
  assert.ok(contract.includes('probe_readability.mjs'), 'Contract must reference mobile readability probe');
  assert.ok(contract.includes('export_jianying.py'), 'Contract must reference Jianying draft export');
});
