#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertDisjoint, buildPackage, verifyPackage} from './build-editions.mjs';
import {resolvePackageProfile} from './package-profile.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aliases = {
  universal: 'universal',
  agents: 'universal',
  codex: 'universal',
  zcode: 'universal',
  claude: 'claude-code',
  'claude-code': 'claude-code',
  workbuddy: 'workbuddy',
  minimax: 'minimax-code',
  'minimax-code': 'minimax-code',
  codebuddy: 'codebuddy',
  doubao: 'doubao-work',
  'doubao-work': 'doubao-work',
};

const folders = {
  universal: '.agents',
  'claude-code': '.claude',
  workbuddy: '.workbuddy',
  'minimax-code': '.minimax',
  codebuddy: '.codebuddy',
};

const usage = `Usage: node scripts/install.mjs [host-or-platform] [project-root] [options]
Platforms:
  (default) / --agents / --codex / --zcode : ~/.agents/skills/anything2video
  --claude / claude                        : ~/.claude/skills/anything2video
  --workbuddy / workbuddy                  : ~/.workbuddy/skills/anything2video
  --minimax / minimax [--data-dir <dir>]   : ~/.minimax/skills/anything2video
  --codebuddy / codebuddy [project-root]   : .codebuddy/skills/anything2video
  --export-dir <dir>                       : <dir>/anything2video (for Doubao Work manual import)
Options:
  --profile core|full                     : core omits sample MP4; full includes them (default: source profile)
  --symlink                                : Create symbolic link instead of copying
  --data-dir <dir>                         : Custom MiniMax Code app data directory
  --export-dir <dir>                       : Export directory for manual host import
`;

const rawArgs = process.argv.slice(2);
let host = 'universal';
let project = null;
let dataDir = null;
let exportDir = null;
let useSymlink = false;
let profile;

const args = [];
for (const arg of rawArgs) {
  if (arg === '--symlink') {
    useSymlink = true;
  } else if (arg.startsWith('--') && aliases[arg.slice(2)]) {
    host = aliases[arg.slice(2)];
  } else {
    args.push(arg);
  }
}

if (args.length > 0 && aliases[args[0]]) {
  host = aliases[args.shift()];
}

while (args.length > 0) {
  const value = args.shift();
  if (value === '--profile') {
    if (profile || !args[0] || args[0].startsWith('--')) throw new Error(usage);
    profile = args.shift();
  } else if (value === '--data-dir') {
    if (dataDir || !args[0] || args[0].startsWith('--')) throw new Error(usage);
    dataDir = path.resolve(args.shift());
  } else if (value === '--export-dir') {
    if (exportDir || !args[0] || args[0].startsWith('--')) throw new Error(usage);
    exportDir = path.resolve(args.shift());
  } else if (value.startsWith('--') || project) {
    throw new Error(usage);
  } else {
    project = path.resolve(value);
  }
}

if (dataDir && host !== 'minimax-code') throw new Error('--data-dir is supported only for MiniMax Code');
if (dataDir && project) throw new Error('Choose either project-root or --data-dir, not both');
if (host === 'doubao-work' && !exportDir) {
  throw new Error('Doubao Work has no verified auto-discovery directory; pass --export-dir <directory> to prepare a complete package for manual import');
}
if (exportDir && (dataDir || project)) throw new Error('Choose either --export-dir or project-root/--data-dir, not both');

profile = resolvePackageProfile(source, {profile});
if (useSymlink && profile !== resolvePackageProfile(source)) throw new Error('--symlink cannot filter resources; use a copy install for a different profile.');

const skillName = 'anything2video';
const dest = exportDir
  ? assertDisjoint(source, path.join(exportDir, skillName))
  : assertDisjoint(
      source,
      path.join(dataDir ?? path.join(project ?? os.homedir(), folders[host] ?? '.agents'), 'skills', skillName)
    );

try {
  fs.lstatSync(dest);
  throw new Error(`Existing skill preserved: ${dest}. Review and update it explicitly.`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

if (useSymlink) {
  verifyPackage(source);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.symlinkSync(source, dest, process.platform === 'win32' ? 'junction' : 'dir');
  console.log(`Linked unified anything2video package at ${dest} -> ${source}`);
} else {
  buildPackage(dest, {source, profile});
  const label = profile === 'full' ? 'complete' : 'core';
  if (exportDir) {
    console.log(`Exported ${label} unified package at ${dest} (profile: ${profile}). Import or authorize this directory explicitly in your host application.`);
  } else {
    console.log(`Installed ${label} unified package at ${dest} (profile: ${profile}). Restart or reload your host, then verify the loaded skill.`);
  }
}

if (host === 'minimax-code') console.log('MiniMax Code discovery: confirm available_skills or call skill({name: "anything2video"}) in next session.');
if (host === 'workbuddy' && !exportDir) console.log('WorkBuddy discovery: restart WorkBuddy and verify anything2video appears in the skills list.');
if (host === 'doubao-work') console.log('Doubao Work discovery: authorize the exported directory in your desktop task and require the entrypoint to be read.');
