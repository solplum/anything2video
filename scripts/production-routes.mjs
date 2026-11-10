#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
export const routeCatalog = read('reference/workflows/catalog.json');
export const styleCatalog = read('styles/catalog.json');
const safePath = value => typeof value === 'string' && !/[\\:#?]/.test(value)
  && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..');
const list = value => Array.isArray(value) ? value : [];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const unique = values => new Set(values).size === values.length;
const recommended = route => [...list(route.recommendedStyles), ...list(route.optionalRecommendedStyles)];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// This validator checks metadata, never the quality or runtime of a film.
// File checks are opt-in so metadata can be inspected in a partial checkout.
// References never require the optional preview MP4s omitted by core packages.
export function validateCatalog(data = routeCatalog, styles = styleCatalog, {pathExists} = {}) {
  const errors = [];
  const require = (ok, message) => { if (!ok) errors.push(message); };
  require(data?.schemaVersion === 1, 'Unsupported route catalog schemaVersion');
  require(data?.selectionFile === 'research/production-route.json', 'Selection must stay outside legacy project/config schemas');
  require(same(data?.runtimeRecipes, ['promo', 'explainer', 'epic']), 'Runtime recipe IDs must remain unchanged');
  require(same(data?.editingModes, ['standard', 'match-cut-beat-relay']), 'Editing modes must remain independent');
  if (!Array.isArray(data?.routes) || !Array.isArray(data?.resources) || !Array.isArray(styles?.styles) || !Array.isArray(data?.materialMethods)) {
    return [...errors, 'routes, resources, styles and materialMethods must be arrays'];
  }
  if (![...data.routes, ...data.resources, ...styles.styles, ...data.materialMethods, ...list(data.treatments)].every(object)) return [...errors, 'Catalog entries must be objects'];
  const routes = data.routes, resources = data.resources;
  const styleIds = new Set(styles.styles.map(s => s.id));
  require(styleIds.size === styles.styles.length, 'Duplicate style ID');
  const resourceIds = new Set(resources.map(r => r.id));
  require(unique(routes.map(r => r.id)), 'Duplicate route ID');
  require(unique(routes.map(r => r.name)), 'Duplicate route display name');
  require(unique(resources.map(r => r.id)), 'Duplicate resource ID');
  require(unique(data.materialMethods.map(m => m.id)), 'Duplicate material method ID');
  const checkPath = (p, label) => {
    require(safePath(p), `Unsafe ${label}: ${p}`);
    if (safePath(p) && pathExists) require(pathExists(p), `Missing ${label}: ${p}`);
  };
  for (const method of data.materialMethods) {
    require(idPattern.test(method.id) && nonempty(method.name), 'Invalid material method');
    checkPath(method.reference, 'material reference');
  }
  for (const resource of resources) {
    require(idPattern.test(resource.id) && nonempty(resource.name) && nonempty(resource.note), `Invalid resource: ${resource.id}`);
    require(['existing-implementation', 'existing-reference', 'historical-record', 'method-reference', 'visual-reference'].includes(resource.kind), `Invalid evidence kind: ${resource.id}`);
    require(Array.isArray(resource.paths) && resource.paths.length > 0, `Missing resource paths: ${resource.id}`);
    for (const p of list(resource.paths)) checkPath(p, 'resource path');
  }
  for (const route of routes) {
    require(idPattern.test(route.id) && nonempty(route.name) && nonempty(route.summary), `Invalid route identity: ${route.id}`);
    require(route.workflow === `reference/workflows/${route.id}.md`, `Incorrect workflow path: ${route.id}`);
    checkPath(route.workflow, 'workflow');
    require(list(data.runtimeRecipes).includes(route.suggestedRecipe), `Invalid suggested recipe: ${route.id}`);
    for (const key of ['inputs', 'checks']) {
      require(Array.isArray(route[key]) && route[key].length >= 2 && route[key].every(nonempty), `Missing ${key}: ${route.id}`);
    }
    require(Array.isArray(route.stages) && route.stages.length >= 3, `Missing distinct stages: ${route.id}`);
    require(unique(list(route.stages).map(s => s?.id)), `Duplicate stage ID: ${route.id}`);
    for (const stage of list(route.stages)) require(object(stage) && idPattern.test(stage.id) && nonempty(stage.name) && nonempty(stage.output), `Invalid stage: ${route.id}`);
    for (const [key, known] of [['recommendedStyles', styleIds], ['resources', resourceIds]]) {
      require(Array.isArray(route[key]) && route[key].length > 0 && unique(route[key]), `Invalid ${key}: ${route.id}`);
      for (const id of list(route[key])) require(known.has(id), `Unknown ${key} ${id} in ${route.id}`);
    }
    require(Array.isArray(route.optionalRecommendedStyles) && unique(route.optionalRecommendedStyles) && route.optionalRecommendedStyles.every(id => typeof id === 'string' && idPattern.test(id)), `Invalid optional recommendations: ${route.id}`);
    require(unique(recommended(route)), `Repeated recommendation: ${route.id}`);
    require(route.readiness?.workflow === 'documented' && route.readiness?.wholeFilm === 'not_validated_by_catalog', `Unsupported readiness claim: ${route.id}`);
  }
  for (const id of styleIds) require(routes.some(r => recommended(r).includes(id)), `Style lacks an entry route: ${id}`);
  require(Array.isArray(data.treatments), 'treatments must be an array');
  require(unique(list(data.treatments).map(t => t.id)), 'Duplicate treatment ID');
  for (const treatment of list(data.treatments)) {
    require(idPattern.test(treatment.id) && nonempty(treatment.name) && nonempty(treatment.family), 'Invalid treatment identity');
    require(routes.some(r => r.id === treatment.route), `Unknown treatment route: ${treatment.id}`);
    if (treatment.status === 'candidate') {
      require(treatment.implementation === 'not_implemented' && treatment.implementedStyleId === undefined, `Unsupported treatment readiness: ${treatment.id}`);
      require(['source_still_inspected', 'source_document_read'].includes(treatment.evidence), `Unsupported treatment evidence: ${treatment.id}`);
    } else if (treatment.status === 'prototype') {
      require(treatment.implementation === 'prototype' && typeof treatment.implementedStyleId === 'string' && idPattern.test(treatment.implementedStyleId), `Invalid prototype implementation: ${treatment.id}`);
      require(treatment.evidence === 'offline_shared_svg_and_sampled_frames', `Unsupported prototype evidence: ${treatment.id}`);
      require(['not_performed', 'blocked'].includes(treatment.verification?.nativeRemotion) && ['fullMotionPlayback', 'audioReview', 'finalFilmQC'].every(key => treatment.verification?.[key] === 'not_performed'), `Unsupported prototype review claim: ${treatment.id}`);
      require(data.routes.some(r => r.id === treatment.route && list(r.optionalRecommendedStyles).includes(treatment.implementedStyleId)), `Prototype must remain optional: ${treatment.id}`);
      require(safePath(treatment.verificationPath), `Unsafe prototype verification path: ${treatment.id}`);
      const installed = styles.styles.find(s => s.id === treatment.implementedStyleId);
      if (installed) {
        require(installed.runtimeSkin === false, `Prototype must remain a manual kit: ${treatment.id}`);
        checkPath(treatment.verificationPath, 'prototype verification');
      }
    } else require(false, `Unsupported treatment readiness: ${treatment.id}`);
    require(!styleIds.has(treatment.id) || (treatment.status === 'prototype' && treatment.implementedStyleId === treatment.id), `Treatment ID collides with an unrelated style: ${treatment.id}`);
    require(idPattern.test(treatment.anchor), `Invalid treatment anchor: ${treatment.id}`);
    checkPath(treatment.guide, 'treatment guide');
  }
  return errors;
}

function findUnique(items, query, kind) {
  if (!nonempty(query)) throw new Error(`Choose a ${kind}`);
  const found = items.filter(item => item.id === query || item.name === query || item.displayName === query || list(item.aliases).includes(query));
  if (found.length !== 1) throw new Error(`Unknown or ambiguous ${kind}: ${query}`);
  return found[0];
}

export function routesForStyle(style, data = routeCatalog, styles = styleCatalog) {
  const selected = findUnique(styles.styles, style, 'style');
  return data.routes.filter(route => recommended(route).includes(selected.id));
}

export function treatmentEntries(data = routeCatalog, styles = styleCatalog) {
  return data.treatments.map(t => ({...t, availableInCatalog: t.status === 'prototype' && styles.styles.some(s => s.id === t.implementedStyleId)}));
}

export function planSelection(input, data = routeCatalog, styles = styleCatalog) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Selection must be an object');
  for (const key of Object.keys(input)) if (!['route', 'style', 'recipe', 'editingMode', 'materialMethod'].includes(key)) throw new Error(`Unknown selection field: ${key}`);
  const route = findUnique(data.routes, input.route, 'route');
  const style = findUnique(styles.styles, input.style, 'style');
  // A selected style retains its existing recipe association. A route's suggested
  // recipe is for discovery only; it must not silently override the selected card.
  const recipe = input.recipe ?? style.recipe;
  if (!data.runtimeRecipes.includes(recipe)) throw new Error(`Not a runtime recipe: ${recipe}`);
  const editingMode = input.editingMode ?? 'standard';
  if (!data.editingModes.includes(editingMode)) throw new Error(`Unknown editingMode: ${editingMode}`);
  const materialMethod = input.materialMethod ?? null;
  if (materialMethod !== null && !data.materialMethods.some(method => method.id === materialMethod)) throw new Error(`Unknown materialMethod: ${materialMethod}`);
  const warnings = ['配色/覆盖层投影不生成主体画面；仍须按 visualSource 接入对应图元、素材与镜头。'];
  if (!recommended(route).includes(style.id)) warnings.push('此组合不在推荐列表中，仍可制作；先确认它能完成这条路线的镜头任务。');
  if (recipe !== style.recipe) warnings.push('显式选择与画风默认配方不同；按既有生产契约记录选型依据，不能静默越过用户决定。');
  if (data.treatments.some(t => t.status === 'prototype' && t.implementedStyleId === style.id)) warnings.push('实验图元：目录样片证据为离线共享 SVG 渲染与抽帧检查；标准 Remotion CLI、连续主观运动审片和最终成片 QC 尚未完成。补充验证范围见 docs/style-browsing.md。');
  if (!style.runtimeSkin) warnings.push('此画风需手动接入图元；不要把它的 ID 写入 config.style。');
  if (style.preview.status !== 'available') warnings.push('目录中没有可用样片；先做本工程打样。');
  if (['layered-assets', 'generated-motion', 'hybrid'].includes(materialMethod)) warnings.push('素材方法不保证生成通道可用；先核实能力、来源、许可与实际合成效果。');
  return {
    schemaVersion: 1,
    productionRoute: route.id,
    visualStyle: style.id,
    visualFamily: style.family,
    recipe,
    editingMode,
    materialMethod,
    workflow: route.workflow,
    // This is a projection to review, not a config rewrite or import generator.
    runtime: {recipe, ...(style.runtimeSkin ? {style: style.id} : {})},
    visualSource: style.source,
    warnings,
    validation: 'selection_only',
  };
}

const usage = `Usage:
  node scripts/production-routes.mjs list [--json]
  node scripts/production-routes.mjs show <route ID or Chinese name>
  node scripts/production-routes.mjs treatments [--json]
  node scripts/production-routes.mjs plan --route <route> --style <style> [--recipe <recipe>] [--editing-mode <mode>] [--material-method <method>]
  node scripts/production-routes.mjs check [--files]

Read-only. plan prints a selection for research/production-route.json; it never
writes project.json/config.ts, installs anything, renders, or approves a film.
check validates metadata. --files additionally requires referenced source files.
`;

export function runCli(argv) {
  const [command, ...args] = argv;
  if (!command || ['help', '--help', '-h'].includes(command)) return usage;
  if (command === 'check') {
    if (args.some(arg => arg !== '--files') || args.length > 1) throw new Error('check accepts only --files');
    const errors = validateCatalog(routeCatalog, styleCatalog, args.includes('--files') ? {pathExists: p => fs.existsSync(path.join(root, p))} : {});
    if (errors.length) throw new Error(errors.join('\n'));
    return `PASS: ${routeCatalog.routes.length} production routes; ${styleCatalog.styles.length} preserved style IDs. ${args.includes('--files') ? 'Referenced files exist.' : 'Metadata only; referenced files/runtime/playback not checked.'}`;
  }
  if (command === 'treatments') {
    if (args.length > 1 || (args.length === 1 && args[0] !== '--json')) throw new Error('treatments accepts only --json');
    const entries = treatmentEntries();
    return args.includes('--json') ? JSON.stringify(entries, null, 2)
      : entries.map(t => `${t.name} (${t.id}) · ${t.family} · ${t.status === 'prototype' ? (t.availableInCatalog ? '原型已接入' : '原型未安装') + '（离线共享 SVG＋抽帧证据，非成片认证）' : '候选，尚未实现'}\n  ${t.guide}#${t.anchor}`).join('\n');
  }
  if (command === 'list') {
    if (args.length > 1 || (args.length === 1 && args[0] !== '--json')) throw new Error('list accepts only --json');
    const items = routeCatalog.routes.map(({id, name, summary, workflow}) => ({id, name, summary, workflow}));
    return args.includes('--json') ? JSON.stringify(items, null, 2) : items.map(r => `${r.name} (${r.id})\n  ${r.summary}`).join('\n');
  }
  if (command === 'show') {
    if (args.length !== 1) throw new Error('show needs exactly one route');
    return JSON.stringify(findUnique(routeCatalog.routes, args[0], 'route'), null, 2);
  }
  if (command === 'plan') {
    const fields = {'--route':'route', '--style':'style', '--recipe':'recipe', '--editing-mode':'editingMode', '--material-method':'materialMethod'};
    const input = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = fields[args[i]], value = args[i + 1];
      if (!key || !value || value.startsWith('--') || Object.hasOwn(input, key)) throw new Error(`Invalid or repeated option: ${args[i]}`);
      input[key] = value;
    }
    return JSON.stringify(planSelection(input), null, 2);
  }
  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(runCli(process.argv.slice(2))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
