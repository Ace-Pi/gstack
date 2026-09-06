import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(import.meta.dir, '..');
const skillPath = path.join(root, 'plan-ceo-review', 'SKILL.md.tmpl');
const sectionsDir = path.join(root, 'plan-ceo-review', 'sections');
const manifestPath = path.join(sectionsDir, 'manifest.json');
const guardsPath = path.join(root, 'test', 'helpers', 'carve-guards.ts');

const source = fs.readFileSync(skillPath, 'utf-8');
const preludeStart = source.indexOf('### 0D-prelude. Expansion Framing');
const analysisStart = source.indexOf('### 0D. Mode-Specific Analysis');
const expStart = source.indexOf('**For SCOPE EXPANSION**', analysisStart);
const selectiveStart = source.indexOf('**For SELECTIVE EXPANSION**', expStart);
const holdStart = source.indexOf('**For HOLD SCOPE**', selectiveStart);
const reductionStart = source.indexOf('**For SCOPE REDUCTION**', holdStart);
const persistStart = source.indexOf('### 0D-POST. Persist CEO Plan', reductionStart);
const temporalStart = source.indexOf('### 0E. Temporal Interrogation', persistStart);
const modeStart = source.indexOf('### 0F. Mode Selection', temporalStart);
const reviewPointer = source.indexOf('{{SECTION:review-sections}}', modeStart);

for (const [name, value] of Object.entries({ preludeStart, analysisStart, expStart, selectiveStart, holdStart, reductionStart, persistStart, temporalStart, modeStart, reviewPointer })) {
  if (value < 0) throw new Error(`Missing Plan CEO carve marker: ${name}`);
}

fs.mkdirSync(sectionsDir, { recursive: true });
const prelude = source.slice(preludeStart, analysisStart).trimEnd() + '\n\n';
const exp = source.slice(expStart, selectiveStart).trimEnd() + '\n\n';
const selective = source.slice(selectiveStart, holdStart).trimEnd() + '\n\n';
const hold = source.slice(holdStart, reductionStart).trimEnd() + '\n\n';
const reduction = source.slice(reductionStart, persistStart).trimEnd() + '\n';
const persist = source.slice(persistStart, temporalStart).trimEnd() + '\n\n';
const temporal = source.slice(temporalStart, modeStart).trimEnd() + '\n';
const modeSelection = source.slice(modeStart, reviewPointer).trimEnd() + '\n\n';

fs.writeFileSync(path.join(sectionsDir, 'scope-expansion.md.tmpl'), `${prelude}${exp}${persist}${temporal}`);
fs.writeFileSync(path.join(sectionsDir, 'selective-expansion.md.tmpl'), `${prelude}${selective}${persist}${temporal}`);
fs.writeFileSync(path.join(sectionsDir, 'hold-scope.md.tmpl'), `${hold}${temporal}`);
fs.writeFileSync(path.join(sectionsDir, 'scope-reduction.md.tmpl'), reduction);

const existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const deepReview = existingManifest.sections.find((s: any) => s.id === 'review-sections');
if (!deepReview) throw new Error('Plan CEO review-sections manifest entry missing');
const manifest = {
  $schema: 'https://gstack.dev/schemas/section-manifest.json',
  skill: 'plan-ceo-review',
  version: 1,
  note: 'ICM progressive loading: Step 0 premise work and mode selection stay eager. Only the selected CEO posture loads its detailed analysis. The 11-section deep review remains deferred until scope and mode are settled.',
  sections: [
    { id: 'scope-expansion', file: 'scope-expansion.md', title: 'Scope expansion vision, opt-in ceremony, CEO-plan persistence, and temporal interrogation', trigger: 'the user selects SCOPE EXPANSION' },
    { id: 'selective-expansion', file: 'selective-expansion.md', title: 'Selective expansion scan, cherry-pick ceremony, CEO-plan persistence, and temporal interrogation', trigger: 'the user selects SELECTIVE EXPANSION' },
    { id: 'hold-scope', file: 'hold-scope.md', title: 'Hold-scope complexity analysis and temporal interrogation', trigger: 'the user selects HOLD SCOPE' },
    { id: 'scope-reduction', file: 'scope-reduction.md', title: 'Scope reduction and ruthless-cut analysis', trigger: 'the user selects SCOPE REDUCTION' },
    deepReview,
  ],
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const routed = `${modeSelection}## Mode-specific analysis\n\nMode selection is now settled. Load exactly one posture section and execute it in full. Do not preload the other three postures.\n\n### SCOPE EXPANSION\n\n{{SECTION:scope-expansion}}\n\n### SELECTIVE EXPANSION\n\n{{SECTION:selective-expansion}}\n\n### HOLD SCOPE\n\n{{SECTION:hold-scope}}\n\n### SCOPE REDUCTION\n\n{{SECTION:scope-reduction}}\n\n---\n\n`;

const rewritten = source.slice(0, preludeStart) + routed + source.slice(reviewPointer);
fs.writeFileSync(skillPath, rewritten);

let guards = fs.readFileSync(guardsPath, 'utf-8');
const start = guards.indexOf("  'plan-ceo-review': {");
const endAnchor = "\n  'plan-eng-review': {";
const end = guards.indexOf(endAnchor, start);
if (start < 0 || end < 0) throw new Error('Could not locate Plan CEO Review carve guard');
const replacement = `  'plan-ceo-review': {
    skill: 'plan-ceo-review',
    expectedSections: ['scope-expansion.md', 'selective-expansion.md', 'hold-scope.md', 'scope-reduction.md', 'review-sections.md'],
    requiredReads: ['hold-scope.md', 'review-sections.md'],
    scenario:
      'Review the plan in PLAN.md in HOLD SCOPE mode. Treat the implementation approach as already approved. Run the mode chooser, load only hold-scope, then run the full 11-section deep review and produce the review report. Do not load expansion or reduction posture sections.',
    staticInvariants: {
      mustStayInSkeleton: [
        '## Step 0: Nuclear Scope Challenge + Mode Selection',
        '### 0A. Premise Challenge',
        '### 0B. Existing Code Leverage',
        '### 0C. Dream State Mapping',
        '### 0C-bis. Implementation Alternatives (MANDATORY)',
        '### 0F. Mode Selection',
        'Critical rule: In ALL modes, the user is 100% in control',
      ],
      mustPrecedeStop: ['### 0A. Premise Challenge', '### 0C-bis. Implementation Alternatives (MANDATORY)', '### 0F. Mode Selection'],
      mustMoveToSection: [
        '### 0D-prelude. Expansion Framing',
        '**For SCOPE EXPANSION**',
        '**For SELECTIVE EXPANSION**',
        '**For HOLD SCOPE**',
        '**For SCOPE REDUCTION**',
        '### 0D-POST. Persist CEO Plan',
        '### 0E. Temporal Interrogation',
        '### Section 1: Architecture Review',
      ],
      gateAfterStop: 'EXIT PLAN MODE GATE',
    },
    behavioral: 'external',
    externalTest: 'test/skill-e2e-plan-ceo-review-section-loading.test.ts',
    maxSkeletonBytes: 65_000,
    minUnionBytes: 123_600,
    mustContain: ['SCOPE EXPANSION', 'SELECTIVE EXPANSION', 'HOLD SCOPE', 'SCOPE REDUCTION'],
    maxSizeRatio: 1.12,
  },`;

guards = guards.slice(0, start) + replacement + guards.slice(end);
fs.writeFileSync(guardsPath, guards);
