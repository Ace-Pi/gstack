import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(import.meta.dir, '..');
const skillPath = path.join(root, 'document-generate', 'SKILL.md.tmpl');
const sectionsDir = path.join(root, 'document-generate', 'sections');
const source = fs.readFileSync(skillPath, 'utf-8');

const headings = {
  reference: '## Step 3: Write Reference Documentation First',
  explanation: '## Step 4: Write Explanation Documentation',
  howto: '## Step 5: Write How-To Guides',
  tutorial: '## Step 6: Write Tutorials',
  linking: '## Step 7: Cross-Document Linking & Discoverability',
};

const pos = Object.fromEntries(
  Object.entries(headings).map(([key, heading]) => [key, source.indexOf(heading)]),
) as Record<keyof typeof headings, number>;

for (const [key, value] of Object.entries(pos)) {
  if (value < 0) throw new Error(`Missing Document Generate carve heading: ${key}`);
}
if (!(pos.reference < pos.explanation && pos.explanation < pos.howto && pos.howto < pos.tutorial && pos.tutorial < pos.linking)) {
  throw new Error('Document Generate carve headings are out of order');
}

fs.mkdirSync(sectionsDir, { recursive: true });

const sections = {
  'reference-docs.md.tmpl': source.slice(pos.reference, pos.explanation).trimEnd() + '\n',
  'explanation-docs.md.tmpl': source.slice(pos.explanation, pos.howto).trimEnd() + '\n',
  'how-to-docs.md.tmpl': source.slice(pos.howto, pos.tutorial).trimEnd() + '\n',
  'tutorial-docs.md.tmpl': source.slice(pos.tutorial, pos.linking).trimEnd() + '\n',
};
for (const [file, content] of Object.entries(sections)) {
  fs.writeFileSync(path.join(sectionsDir, file), content);
}

const manifest = {
  $schema: 'https://gstack.dev/schemas/section-manifest.json',
  skill: 'document-generate',
  version: 1,
  note: 'ICM progressive loading: scope, research, partitioning, quality, safety, and release stay eager; only selected Diataxis writing playbooks load after the partition plan is known.',
  sections: [
    {
      id: 'reference-docs',
      file: 'reference-docs.md',
      title: 'Reference documentation writing playbook',
      trigger: 'the Step 2 Diataxis partition plan includes Reference for at least one target entity',
    },
    {
      id: 'explanation-docs',
      file: 'explanation-docs.md',
      title: 'Explanation documentation writing playbook',
      trigger: 'the Step 2 Diataxis partition plan includes Explanation for at least one target entity',
    },
    {
      id: 'how-to-docs',
      file: 'how-to-docs.md',
      title: 'How-to documentation writing playbook',
      trigger: 'the Step 2 Diataxis partition plan includes How-to for at least one target entity',
    },
    {
      id: 'tutorial-docs',
      file: 'tutorial-docs.md',
      title: 'Tutorial documentation writing playbook',
      trigger: 'the Step 2 Diataxis partition plan includes Tutorial for at least one target entity',
    },
  ],
};
fs.writeFileSync(path.join(sectionsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const routed = `{{SECTION_INDEX:document-generate}}

## Steps 3-6: Write the selected Diataxis documents

Step 2 decides which quadrants apply. Load only the playbooks selected by that partition plan.
If a quadrant is not selected for any target entity, do not load its section.

### Reference documentation

{{SECTION:reference-docs}}

### Explanation documentation

{{SECTION:explanation-docs}}

### How-to documentation

{{SECTION:how-to-docs}}

### Tutorial documentation

{{SECTION:tutorial-docs}}

---

`;

const rewritten = source.slice(0, pos.reference) + routed + source.slice(pos.linking);
fs.writeFileSync(skillPath, rewritten);

const guardsPath = path.join(root, 'test', 'helpers', 'carve-guards.ts');
let guards = fs.readFileSync(guardsPath, 'utf-8');
if (!guards.includes("'document-generate': {")) {
  const anchor = "  'qa-only': {\n";
  let at = guards.indexOf(anchor);
  if (at < 0) {
    const fallback = "  'design-review': {\n";
    at = guards.indexOf(fallback);
  }
  if (at < 0) throw new Error('Could not find carve guard insertion anchor');

  const entry = `  'document-generate': {
    skill: 'document-generate',
    expectedSections: ['reference-docs.md', 'explanation-docs.md', 'how-to-docs.md', 'tutorial-docs.md'],
    requiredReads: ['reference-docs.md', 'explanation-docs.md'],
    scenario:
      'Walk /document-generate in SIMULATION for an internal scheduler module. Treat scope as already confirmed and research as complete: the module has a public TypeScript API plus two non-obvious design decisions, but no end-user workflow. Partition it into Reference + Explanation only. Do not write files, commit, push, browse, or use AskUserQuestion. Read only the selected writing playbooks, then produce the documentation plan and a concise outline of the two documents.',
    staticInvariants: {
      mustStayInSkeleton: [
        '## Step 0: Scope & Intent',
        '## Step 1: Codebase Archaeology (Research Phase)',
        '## Step 2: Diataxis Partitioning',
        '## Step 7: Cross-Document Linking & Discoverability',
        '## Step 8: Quality Self-Review',
        '## Step 9: Commit & Output',
        'Redaction scan before commit',
        '## Important Rules',
      ],
      mustPrecedeStop: ['## Step 0: Scope & Intent', '## Step 1: Codebase Archaeology (Research Phase)', '## Step 2: Diataxis Partitioning'],
      mustMoveToSection: [
        '## Step 3: Write Reference Documentation First',
        '## Step 4: Write Explanation Documentation',
        '## Step 5: Write How-To Guides',
        '## Step 6: Write Tutorials',
        'Reference doc template:',
        'Tutorial doc template:',
      ],
      gateAfterStop: undefined,
    },
    behavioral: 'prompt',
    maxSkeletonBytes: 43_500,
    minUnionBytes: 47_000,
    mustContain: ['Diataxis', 'Reference', 'Explanation', 'How-to', 'Tutorial', 'Research before writing'],
    maxSizeRatio: 1.08,
  },
`;
  guards = guards.slice(0, at) + entry + guards.slice(at);
  fs.writeFileSync(guardsPath, guards);
}
