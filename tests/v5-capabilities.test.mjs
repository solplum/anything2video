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

test('export_jianying.py successfully exports multi-track native draft structure', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-jianying-test-'));
  const projectDir = path.join(tmpDir, 'mock-project');
  const outDir = path.join(tmpDir, 'jianying-draft-out');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'script'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'renders'), { recursive: true });

  // 1. Mock project.json
  fs.writeFileSync(
    path.join(projectDir, 'project.json'),
    JSON.stringify({
      slug: 'mock-doc',
      width: 1920,
      height: 1080,
      fps: 30,
      totalFrames: 180,
      recipe: 'documentary',
    }, null, 2)
  );

  // 2. Mock script/storyboard.json
  fs.writeFileSync(
    path.join(projectDir, 'script', 'storyboard.json'),
    JSON.stringify({
      shots: [
        { id: 'S01', from: 1, to: 90, purpose: '档案陈列', action: '古籍翻拍扫描' },
        { id: 'S02', from: 91, to: 180, purpose: '印鉴特写', action: '朱砂印盖下' },
      ],
      claims: [],
      assets: [],
    }, null, 2)
  );

  // 3. Mock script/narration.txt
  fs.writeFileSync(
    path.join(projectDir, 'script', 'narration.txt'),
    '这是一段珍贵的历史原声纪录。\n见证了文明的演变与岁月的沉淀。'
  );

  // 4. Mock script/timeline.json
  fs.writeFileSync(
    path.join(projectDir, 'script', 'timeline.json'),
    JSON.stringify({
      sentences: [
        { text: '这是一段珍贵的历史原声纪录。', start: 0.5, end: 3.0 },
        { text: '见证了文明的演变与岁月的沉淀。', start: 3.2, end: 5.8 },
      ],
    }, null, 2)
  );

  // 5. Mock a tiny wav/mp4 file to act as renders
  const dummyFile = Buffer.from('RIFF....WAVEfmt ....data....');
  fs.writeFileSync(path.join(projectDir, 'renders', 'mock-doc_final.mp4'), dummyFile);
  fs.writeFileSync(path.join(projectDir, 'audio', 'audio_narration.wav'), dummyFile);

  // 6. Run export_jianying.py
  const scriptPath = path.join(root, 'scripts', 'export_jianying.py');
  const pyOutput = execFileSync('python3', [scriptPath, projectDir, '--out', outDir], {
    encoding: 'utf8',
  });

  assert.ok(pyOutput.includes('剪映原生草稿工程成功导出至') || pyOutput.includes('Jianying draft') || fs.existsSync(outDir));

  // 7. Verify exported draft directory contents
  assert.ok(fs.existsSync(outDir), 'Output directory must exist');
  const draftDir = fs.existsSync(path.join(outDir, 'draft_info.json'))
    ? outDir
    : path.join(outDir, 'mock-project');
  const draftInfoPath = path.join(draftDir, 'draft_info.json');
  const draftContentPath = path.join(draftDir, 'draft_content.json');
  assert.ok(fs.existsSync(draftInfoPath) || fs.existsSync(draftContentPath), 'Must generate draft json');

  const draftData = JSON.parse(fs.readFileSync(fs.existsSync(draftInfoPath) ? draftInfoPath : draftContentPath, 'utf8'));
  assert.ok(Array.isArray(draftData.tracks), 'Draft must contain tracks array');
  
  // Verify track types
  const trackTypes = draftData.tracks.map(t => t.type);
  assert.ok(trackTypes.includes('video'), 'Must contain video track');
  assert.ok(trackTypes.includes('audio'), 'Must contain audio track');
  assert.ok(trackTypes.includes('text'), 'Must contain text subtitle track');

  // Verify texts exist
  assert.ok(draftData.materials.texts.length >= 2, 'Must export text subtitle materials');

  // Clean up tmp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });
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
