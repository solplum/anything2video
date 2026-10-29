"""Routing/packaging regressions, not evidence that a video was watched or heard."""
import json
from pathlib import Path
import re
import subprocess
import unittest
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
ENTRY_PATH = ("SKILL.md", "reference/production-contract.md", "reference/production-workflow.md")
ROUTING_DOCS = ENTRY_PATH + (
    "reference/workflow-orchestration.md", "reference/tools-and-components.md",
    "reference/context-index.md", "reference/explainer/README.md",
    "reference/reference-breakdown.md", "reference/visual-direction.md",
    "recipes/explainer.md", "recipes/_schema.md", "recipes/documentary.md",
    "recipes/promo.md", "recipes/epic.md", "recipes/custom.md",
    "reference/desktop-hosts.md", "reference/bgm-library.md",
    "reference/bgm-bakeoff.md", "reference/music-plan.md", "reference/sound-design.md",
    "docs/adapters.md", "styles/riso-print/SPEC.md",
)


def local_links(doc):
    text = (ROOT / doc).read_text(encoding="utf-8")
    for raw in re.findall(r"\]\(([^)]+)\)", text):
        url = urlsplit(raw)
        if url.scheme or url.netloc:
            continue
        target = (ROOT / doc).parent / unquote(url.path) if url.path else ROOT / doc
        yield raw, target.resolve(), unquote(url.fragment)


def anchor_ids(target):
    text = target.read_text(encoding="utf-8")
    explicit = set(re.findall(r'<a\s+id="([^"]+)"', text))
    headings = re.findall(r"^#{1,6}\s+(.+)$", text, re.M)
    # GitHub-style generated heading anchors; explicit IDs used for shared rules.
    return explicit | {re.sub(r"[^\w\-\s]", "", h.lower()).replace(" ", "-") for h in headings}


class DocumentationRoutingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = subprocess.run(
            ["node", "--input-type=module", "-e",
             "import {collectCoreFiles} from './scripts/build-editions.mjs';"
             "console.log(JSON.stringify(Object.fromEntries(['core','full'].map(profile=>"
             "[profile,collectCoreFiles(process.cwd(),{profile})]))));"],
            cwd=ROOT, check=True, capture_output=True, text=True,
        )
        cls.packages = {profile: set(files) | {"SKILL.md", "README.md", "LICENSE"}
                        for profile, files in json.loads(result.stdout).items()}

    def test_local_routes_exist_in_checkout_and_both_install_profiles(self):
        for doc in ROUTING_DOCS:
            for raw, target, fragment in local_links(doc):
                with self.subTest(doc=doc, target=raw):
                    self.assertTrue(target.is_relative_to(ROOT), "route escapes skill")
                    self.assertTrue(target.exists(), "missing checkout target")
                    relative = target.relative_to(ROOT).as_posix()
                    for profile, files in self.packages.items():
                        present = (any(f.startswith(relative + "/") for f in files)
                                   if target.is_dir() else relative in files)
                        self.assertTrue(present, f"{profile}: route absent from install")
                    if fragment and target.suffix == ".md":
                        self.assertIn(fragment, anchor_ids(target), "broken section anchor")

    def test_every_top_level_reference_has_an_explicit_discovery_route(self):
        # No capability should become orphaned when entry detail is shortened.
        linked = set()
        for doc in ROUTING_DOCS:
            linked.update(target for _, target, _ in local_links(doc))
        for reference in (ROOT / "reference").glob("*.md"):
            self.assertIn(reference.resolve(), linked, f"unrouted reference: {reference.name}")

    def test_initial_read_path_stays_smaller_without_counting_optional_indexes(self):
        # Baseline 5f2e5e0: 28,496 + 21,884 + 8,415 = 58,795 bytes.
        sizes = [(ROOT / path).stat().st_size for path in ENTRY_PATH]
        self.assertLessEqual(sizes[0], 8000, "entry must remain a concise router")
        self.assertLessEqual(sum(sizes), 40000, "common mandatory path has regrown")
        # Optional tools/history stay separately discoverable, not hidden deletions.
        entry_targets = {target for _, target, _ in local_links("SKILL.md")}
        for doc in ("reference/context-index.md", "reference/tools-and-components.md"):
            self.assertIn((ROOT / doc).resolve(), entry_targets)

    def test_active_entry_routes_approval_and_platform_to_single_contract_sections(self):
        expected = {"script-approval", "publication"}
        for doc in ("SKILL.md", "reference/production-workflow.md"):
            sections = {fragment for _, target, fragment in local_links(doc)
                        if target == ROOT / "reference/production-contract.md"}
            self.assertTrue(expected <= sections, f"{doc}: missing authority routes")
        # Do not duplicate mutable gallery counts outside the gallery itself.
        for doc in ENTRY_PATH:
            self.assertIsNone(re.search(r"\d+\s*张(?:\*\*)?[^。\n]{0,8}配方卡", (ROOT / doc).read_text()), doc)

    def test_documented_machine_states_match_runtime_without_an_invented_approval_gate(self):
        runtime = (ROOT / "scripts/check_state.mjs").read_text()
        states = re.findall(r"'([^']+)'", re.search(r"export const STATES = \[([^\]]+)\]", runtime).group(1))
        index = (ROOT / "reference/tools-and-components.md").read_text()
        sequence = re.search(r"intake(?: → [a-z]+)+", index).group(0).split(" → ")
        self.assertEqual(sequence, states)
        self.assertNotIn("approved", states)
        contract = (ROOT / "reference/production-contract.md").read_text()
        self.assertIn("不读取或校验 `script/approval.json`", contract)
        self.assertIn("人工授权门", contract)

    def test_documentary_example_uses_an_existing_runtime_recipe(self):
        document = (ROOT / "recipes/documentary.md").read_text()
        runtime = (ROOT / "template/src/recipes/types.ts").read_text()
        recipe_type = re.search(r"export type RecipeId = ([^;]+);", runtime).group(1)
        supported = set(re.findall(r"'([^']+)'", recipe_type))
        project = json.loads(re.search(r'```json\s+(\{\s+"recipe"[\s\S]+?)```', document).group(1))
        config_recipe = re.search(r"```ts\s+recipe: '([^']+)'", document).group(1)
        self.assertIn(project["recipe"], supported)
        self.assertEqual(project["recipe"], config_recipe)
        recipe_assertion = re.search(r"```ts\s+recipe: '[^']+' as ([^,]+),", document)
        self.assertIsNotNone(recipe_assertion, "copyable field must preserve the runtime union assertion")
        self.assertEqual(set(re.findall(r"'([^']+)'", recipe_assertion.group(1))), supported)
        dimensions = (ROOT / "template/src/common/lib.tsx").read_text()
        for field, constant in (("width", "W"), ("height", "H"), ("fps", "FPS")):
            value = int(re.search(rf"export const {constant} = (\d+);", dimensions).group(1))
            self.assertEqual(project[field], value, "example must match default Composition")
        result = subprocess.run(
            ["node", "--input-type=module", "-e",
             "import {validatePlan} from './scripts/check-plan.mjs';"
             f"const project={json.dumps(project)}; project.totalFrames=30;"
             "const shots=[{id:'S1',from:1,to:30,group:'G1',component:'src/Shot.tsx',"
             "purpose:'archive',action:'reveal'}];"
             "console.log(JSON.stringify(validatePlan(project,{shots,claims:[],assets:[]})));"],
            cwd=ROOT, check=True, capture_output=True, text=True,
        )
        self.assertEqual(json.loads(result.stdout), [])


if __name__ == "__main__":
    unittest.main()
