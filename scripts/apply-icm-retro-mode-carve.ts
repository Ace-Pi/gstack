import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(import.meta.dir, '..');
const skillPath = path.join(root, 'retro', 'SKILL.md.tmpl');
const sectionsDir = path.join(root, 'retro', 'sections');
const manifestPath = path.join(sectionsDir, 'manifest.json');
const guardsPath = path.join(root, 'test', 'helpers', 'carve-guards.ts');

const source = fs.readFileSync(skillPath, 'utf-8');
const normalStart = source.indexOf('### Step 0.5: Freshness pre-flight (fetch)');
const globalStart = source.indexOf('## Global Retrospective Mode');
const compareStart = source.indexOf('## Compare Mode');
const toneStart = source.indexOf('## Tone');

for (const [name, value] of Object.entries({ normalStart, globalStart, compareStart, toneStart })) {
  if (value < 0) throw new Error(`Missing Retro carve heading: ${name}`);
}
if (!(normalStart < globalStart && globalStart < compareStart && compareStart < toneStart)) {
  throw new Error('Retro carve headings are out of order');
}

fs.mkdirSync(sectionsDir, { recursive: true });
fs.writeFileSync(
  path.join(sectionsDir, 'repo-retro.md.tmpl'),
  source.slice(normalStart, globalStart).trimEnd() + '\n',
);
fs.writeFileSync(
  path.join(sectionsDir, 'global-retro.md.tmpl'),
  source.slice(globalStart, compareStart).trimEnd() + '\n',
);
fs.writeFileSync(
  path.join(sectionsDir, 'compare-retro.md.tmpl'),
  source.slice(compareStart, toneStart).trimEnd() + '\n',
);

const existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const reportFormat = existingManifest.sections.find((s: any) => s.id === 'report-format');
if (!reportFormat) throw new Error('Retro report-format section missing from manifest');

const manifest = {
  $schema: 'https://gstack.dev/schemas/section-manifest.json',
  skill: 'retro',
  version: 1,
  note: 'ICM progressive loading: argument parsing and mode dispatch stay eager; repo, global, and compare workflows load only after mode resolution. Narrative format remains a late repo-retro read.',
  sections: [
    {
      id: 'repo-retro',
      file: 'repo-retro.md',
      title: 'Repository-scoped retrospective metrics, analysis, history, and narrative handoff',
      trigger: 'the parsed mode is the default repository retrospective rather than global or compare',
    },
    {
      id: 'global-retro',
      file: 'global-retro.md',
      title: 'Cross-project global retrospective discovery, aggregation, narrative, history, and snapshot flow',
      trigger: 'the first argument is global',
    },
    {
      id: 'compare-retro',
      file: 'compare-retro.md',
      title: 'Current-window versus prior-window comparison flow',
      trigger: 'the first argument is compare',
    },
    reportFormat,
  ],
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const dispatch = `## Mode dispatch\n\nThe argument parse above decides which workflow to load. Load exactly the selected mode now; do not preload the other modes.\n\n### Default repository retrospective\n\n{{SECTION:repo-retro}}\n\n### Global retrospective\n\n{{SECTION:global-retro}}\n\n### Compare mode\n\n{{SECTION:compare-retro}}\n\n---\n\n`;

const rewritten = source.slice(0, normalStart) + dispatch + source.slice(toneStart);
fs.writeFileSync(skillPath, rewritten);

let guards = fs.readFileSync(guardsPath, 'utf-8');
const guardStart = guards.indexOf('  retro: {');
const guardEndAnchor = '\n  },\n\n  // ── Token-reduction Phase 4 wave 4';
const guardEnd = guards.indexOf(guardEndAnchor, guardStart);
if (guardStart < 0 || guardEnd < 0) throw new Error('Could not locate existing Retro carve guard');

const replacement = `  retro: {
    skill: 'retro',
    expectedSections: ['repo-retro.md', 'global-retro.md', 'compare-retro.md', 'report-format.md'],
    requiredReads: ['repo-retro.md', 'report-format.md'],
    scenario:
      'Run the repo-scoped weekly retrospective for the last 7 days on this repo. There is no origin remote — proceed with the local branch per the guard disclosure rules. The gstack-retro-metrics script is not installed, so follow the degraded path (compute the metrics manually with git). Skip any AskUserQuestion calls — this is non-interactive. Route to the repo-retro section, then read report-format only when Step 14 starts. Produce the full narrative retrospective report.',
    staticInvariants: {
      mustStayInSkeleton: [
        '## Instructions',
        'Midnight-aligned windows',
        'Argument validation',
        'If the first argument is ',
        '## Mode dispatch',
        '## Tone',
        '## Important Rules',
      ],
      mustPrecedeStop: ['## Instructions', 'Midnight-aligned windows', 'Argument validation', '## Mode dispatch'],
      mustMoveToSection: [
        '### Step 0.5: Freshness pre-flight (fetch)',
        '### Step 2: Compute Metrics',
        '### Step 13: Save Retro History',
        '## Global Retrospective Mode',
        '### Global Step 7: Aggregate and generate narrative',
        '## Compare Mode',
        '## Engineering Retro: [date range]',
      ],
      gateAfterStop: undefined,
    },
    behavioral: 'prompt',
    maxSkeletonBytes: 43_000,
    minUnionBytes: 70_000,
    mustContain: ['retrospective', '45-minute gap', 'Ship of the week', 'Praise', 'global', 'compare'],
    maxSizeRatio: 1.10,
  },`;

guards = guards.slice(0, guardStart) + replacement + guards.slice(guardEnd + '\n  },'.length);
fs.writeFileSync(guardsPath, guards);
