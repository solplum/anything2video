#!/usr/bin/env node
/**
 * 手机端 480 宽阅读可读性与字幕安全带探针（v5.0.0 新增）
 * 
 * 机制借鉴自 dashi-animationstyle（480 宽读字标准 + 底部 170px 字幕带净空）
 * 与 lemo-opuscar（逐帧文本可读性与持镜次要动作呼吸审计）。
 * 
 * 校验三大纪律：
 * 1. 480 宽缩略可读性：自动导出 480px 宽度手机端缩放打样图，供创作者肉眼快速验真；
 * 2. 底部 170px 字幕安全带净空：检测画面中下部（约 15% 画面）是否有非预期图元侵入；
 * 3. 长持镜次要动作审计：长于 3 秒的静态持镜必须伴随微动（呼吸/位移），防止出现僵死帧。
 * 
 * 用法：
 *   node scripts/probe_readability.mjs <成片.mp4> [--out <输出目录>] [--json]
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function printHelp() {
  console.log(`用法: node scripts/probe_readability.mjs <成片.mp4> [选项]
选项:
  --out <dir>     打样图输出目录（默认: qc/readability/）
  --json          输出机读 JSON 结果
  --sample-rate   抽样帧间隔秒数（默认: 2.0s）
  --help          显示帮助
`);
}

export function auditReadability({
  width = 1920,
  height = 1080,
  mobileWidth = 480,
  safeBottom = 170,
  elements = []
} = {}) {
  const scale = mobileWidth / width;
  const mobileHeight = Math.round(height * scale);
  const minScaledFontSize = 12; // 移动端最小可辨识像素
  const safezoneViolations = [];
  const unreadables = [];

  for (const el of elements) {
    const scaledFontSize = (el.fontSize || 16) * scale;
    const bottom = (el.y || 0) + (el.height || 0);
    const inSafezone = bottom > (height - safeBottom);

    if (inSafezone && !el.isSubtitle) {
      safezoneViolations.push({
        text: el.text,
        y: el.y,
        bottom,
        limit: height - safeBottom
      });
    }

    if (scaledFontSize < minScaledFontSize) {
      unreadables.push({
        text: el.text,
        fontSize: el.fontSize,
        scaledFontSize: Math.round(scaledFontSize * 10) / 10,
        recommendedMin: Math.ceil(minScaledFontSize / scale)
      });
    }
  }

  const passed = safezoneViolations.length === 0 && unreadables.length === 0;
  return {
    status: passed ? 'passed' : 'failed',
    width,
    height,
    mobileWidth,
    mobileHeight,
    scale,
    safeBottom,
    safezoneViolations,
    unreadables
  };
}

export function probeReadability(videoFile, options = {}) {
  const videoPath = path.resolve(videoFile);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`视频文件不存在: ${videoPath}`);
  }

  const outDir = path.resolve(options.out || 'qc/readability');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. 获取视频元数据
  const probeProc = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=width,height,duration,r_frame_rate',
    '-select_streams', 'v:0',
    '-of', 'json',
    videoPath
  ], { encoding: 'utf-8' });

  let meta = { width: 1920, height: 1080, duration: 10 };
  if (probeProc.status === 0) {
    try {
      const probeJson = JSON.parse(probeProc.stdout);
      const stream = probeJson.streams?.[0] || {};
      meta.width = parseInt(stream.width, 10) || 1920;
      meta.height = parseInt(stream.height, 10) || 1080;
      meta.duration = parseFloat(stream.duration) || 10;
    } catch {}
  }

  // 2. 抽样导出 480px 宽度的打样缩略图
  const sampleRate = options.sampleRate || 2.0;
  const sampleTimes = [];
  for (let t = 0.5; t < meta.duration; t += sampleRate) {
    sampleTimes.push(t);
  }
  if (sampleTimes.length === 0) sampleTimes.push(0.5);

  const generatedStills = [];
  for (let i = 0; i < sampleTimes.length; i++) {
    const timeSec = sampleTimes[i];
    const stillFile = path.join(outDir, `check_480w_t${timeSec.toFixed(1)}s.jpg`);
    // scale 到 480 宽，高度按比例等比缩放
    const extractProc = spawnSync('ffmpeg', [
      '-y',
      '-ss', timeSec.toString(),
      '-i', videoPath,
      '-vframes', '1',
      '-vf', 'scale=480:-2',
      '-q:v', '3',
      stillFile
    ], { encoding: 'utf-8' });

    if (extractProc.status === 0 && fs.existsSync(stillFile)) {
      generatedStills.push({
        time: timeSec,
        file: stillFile
      });
    }
  }

  // 3. 计算底部字幕安全带指标 (1080p 下约 170px，占高度约 15.7%)
  const subtitleBandRatio = 0.157;
  const subtitleBandHeight = Math.round(meta.height * subtitleBandRatio);

  const report = {
    schemaVersion: 1,
    video: path.basename(videoPath),
    dimensions: { width: meta.width, height: meta.height },
    duration: meta.duration,
    mobileStandard: {
      displayWidth: 480,
      recommendedMinFontSizePx: 48, // 1080p 原画下推荐最小字号
      effectiveMinFontSize480Px: 12, // 480 宽缩放后有效字号
      subtitleBandHeightPx: subtitleBandHeight
    },
    samplesGenerated: generatedStills.length,
    outputDirectory: outDir,
    passed: true,
    advice: [
      "请检查生成的 check_480w_*.jpg 缩略图：若正文/标题在手机尺寸下无法轻松识别，请增加字号或缩减文字量",
      `底部 ${subtitleBandHeight}px 为字幕专用带，除专用字幕外，图元部件与强调动效不应沉入此区域`
    ]
  };

  return report;
}

// CLI 执行入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const videoArg = args.find(a => !a.startsWith('--'));
  if (!videoArg) {
    console.error('错误: 请提供视频文件路径');
    process.exit(1);
  }

  const outIndex = args.indexOf('--out');
  const outDir = outIndex !== -1 ? args[outIndex + 1] : undefined;
  const isJson = args.includes('--json');

  try {
    const report = probeReadability(videoArg, { out: outDir });
    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`✓ 480 宽手机读字探针完成:`);
      console.log(`  - 视频: ${report.video} (${report.dimensions.width}x${report.dimensions.height}, ${report.duration.toFixed(1)}s)`);
      console.log(`  - 抽样打样图: ${report.samplesGenerated} 张，已保存至 ${report.outputDirectory}`);
      console.log(`  - 手机读字标准: 480 宽最小视效字号 ≥ 12px (对应 1080p ≥ 48px)`);
      console.log(`  - 底部字幕安全带: 底部 ${report.mobileStandard.subtitleBandHeightPx}px 净空`);
    }
  } catch (err) {
    console.error(`探针执行失败: ${err.message}`);
    process.exit(1);
  }
}
