import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalog, styleName, browseSections, selectionGroups, generate} from '../scripts/style-catalog.mjs';
import {catalogUi} from './helpers/catalog-ui.mjs';

const legacy = JSON.parse(fs.readFileSync(new URL('./fixtures/style-compat.json', import.meta.url)));
const legacyLabels = JSON.parse(fs.readFileSync(new URL('./fixtures/style-labels.json', import.meta.url)));
const visible = ui => ui.variants.filter(v => !v.hidden && (ui.families.length === 0 || !v.closest('.family').hidden));

test('visual taxonomy covers each ID once, keeps family variants together and never changes runtime contracts', () => {
  const sections = browseSections();
  assert.equal(sections.length, 8);
  const legacyIds = new Set(legacy.styles.map(s => s.id));
  assert.deepEqual(catalog.styles.filter(s => legacyIds.has(s.id)).map(({id, recipe, source}) => ({id, recipe, source})), legacy.styles);
  assert.deepEqual(sections.flatMap(s => s.styles.map(v => v.id)).sort(), catalog.styles.map(s => s.id).sort());
  assert.equal(sections.reduce((count, s) => count + s.groups.length, 0), selectionGroups().length);
  for (const family of selectionGroups()) assert.equal(new Set(family.members.map(s => s.showcase.section)).size, 1);
  assert.equal(new Set(catalog.styles.map(styleName)).size, catalog.styles.length);
  for (const style of catalog.styles) {
    if (Object.hasOwn(legacyLabels, style.id)) assert.equal(style.name, legacyLabels[style.id]);
    assert.ok(styleName(style).trim());
    if (style.name !== styleName(style)) assert.ok(style.aliases.includes(style.name));
  }
});

test('all eight category buttons filter both browser modes and both media profiles', () => {
  for (const flat of [false, true]) for (const profile of ['core', 'full']) {
    const ui = catalogUi({flat, profile});
    assert.equal(ui.sectionButtons.length, 9);
    assert.equal(ui.variants.length, catalog.styles.length);
    for (const section of browseSections()) {
      ui.chooseSection(section.id);
      assert.equal(ui.controls['results-title'].textContent, section.name);
      assert.equal(ui.controls['section-description'].textContent, section.description);
      assert.equal(ui.controls.status.textContent, `当前显示 ${flat ? section.styles.length : section.groups.length} 个${flat ? '变体' : '选择入口'}`);
      assert.ok(visible(ui).every(s => s.dataset.section === section.id));
      assert.equal(ui.sectionButtons.find(b => b.dataset.sectionChoice === section.id).attrs['aria-pressed'], 'true');
      assert.equal(ui.sectionButtons.filter(b => b.attrs['aria-pressed'] === 'true').length, 1);
      assert.equal(ui.location.hash, '#category-' + section.id);
      assert.ok(ui.controls.results.scrolled > 0);
      assert.equal(ui.controls['view-link'].hash, ui.location.hash);
    }
    ui.chooseSection('all');
    assert.equal(ui.controls.status.textContent, `当前显示 ${flat ? catalog.styles.length : selectionGroups().length} 个${flat ? '变体' : '选择入口'}`);
  }
});

test('every new name, original name and compatibility ID remains searchable', () => {
  for (const flat of [false, true]) {
    const ui = catalogUi({flat});
    for (const style of catalog.styles) for (const term of [style.id, style.name, styleName(style), ...(style.aliases ?? [])]) {
      ui.filter('search', term);
      const result = ui.variants.find(v => v.id === style.id);
      // A legacy short name may match both siblings. The matching variant stays selectable.
      if (flat) assert.equal(result.hidden, false, `${style.id}: ${term}`);
      else {
        const family = result.closest('.family');
        assert.equal(family.hidden, false, `${style.id}: ${term}`);
        const button = family.buttons.find(b => b.dataset.member === style.id);
        if (button) assert.equal(button.disabled, false, `${style.id}: ${term}`);
        else assert.equal(result.hidden, false, `${style.id}: ${term}`);
      }
    }
  }
});

test('category, search, purpose and mood combine; reset recovers empty results and pauses hidden video', () => {
  for (const flat of [false, true]) for (const profile of ['core', 'full']) {
    const ui = catalogUi({flat, profile});
    ui.chooseSection('night-and-future');
    ui.filter('search', '夜航');
    assert.deepEqual(visible(ui).map(s => s.id), ['mg-purple']);
    ui.filter('type', 'explainer');
    ui.filter('vibe', 'cool');
    assert.deepEqual(visible(ui).map(s => s.id), ['mg-purple']);
    ui.filter('type', 'promo');
    assert.equal(ui.controls.empty.hidden, false);
    ui.reset();
    assert.equal(ui.controls.empty.hidden, true);
    assert.equal(ui.controls.search.value, '');
    assert.equal(ui.controls.type.value, 'all');
    assert.equal(ui.controls.vibe.value, 'all');
    assert.equal(ui.controls['results-title'].textContent, '全部风格');
    assert.equal(ui.controls.status.textContent, `当前显示 ${flat ? catalog.styles.length : selectionGroups().length} 个${flat ? '变体' : '选择入口'}`);
    if (profile === 'full') assert.ok(ui.variants.filter(v => v.video && v.id !== 'mg-purple').every(v => v.video.pauses > 0));
  }
});

test('category and original style deep links survive back/forward and repeated selection', () => {
  for (const flat of [false, true]) {
    const ui = catalogUi({flat, hash: '#category-print-and-ornament'});
    assert.equal(ui.controls['results-title'].textContent, '印刷与装饰');
    ui.chooseSection('night-and-future');
    const pushes = ui.pushes.length;
    ui.chooseSection('night-and-future');
    assert.equal(ui.pushes.length, pushes);
    ui.filter('search', 'not-a-style');
    ui.navigate('#lily-pond', 'popstate');
    assert.equal(ui.controls['results-title'].textContent, '全部风格');
    assert.ok(visible(ui).some(s => s.id === 'lily-pond'));
    assert.equal(ui.controls.search.value, '');
    ui.navigate('#category-print-and-ornament', 'popstate');
    assert.ok(visible(ui).every(s => s.dataset.section === 'print-and-ornament'));
    for (const hash of ['#%E0%A4%A', '#unknown-style', '#category-unknown', '#results']) assert.doesNotThrow(() => ui.navigate(hash));
    ui.navigate('#browse-all', 'popstate');
    assert.equal(ui.controls.status.textContent, `当前显示 ${flat ? catalog.styles.length : selectionGroups().length} 个${flat ? '变体' : '选择入口'}`);
    for (const style of catalog.styles) {
      ui.navigate('#' + encodeURIComponent(style.id));
      assert.ok(visible(ui).some(s => s.id === style.id), style.id);
    }
  }
});

test('generated pages retain accessible controls, explicit preview gaps and optional-media behavior', () => {
  for (const flat of [false, true]) for (const profile of ['core', 'full']) {
    const {html} = catalogUi({flat, profile});
    assert.match(html, /role="group" aria-label="视觉分类"/);
    assert.match(html, /id="status" aria-live="polite"/);
    assert.match(html, /aria-controls="grid"/);
    assert.match(html, /min-height:44px/);
    assert.match(html, /:focus-visible/);
    assert.match(html, /<noscript>/);
    assert.match(html, /暂无渲染样片/);
    assert.doesNotMatch(html, /autoplay/);
    if (profile === 'core') {
      assert.doesNotMatch(html, /<video|(?:src|href)="[^"\n]+\.mp4"/);
      assert.match(html, /可选视频未安装/);
    }
  }
  generate({check: true});
});
