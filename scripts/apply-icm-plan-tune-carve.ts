import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(import.meta.dir, '..');
const skillPath = path.join(root, 'plan-tune', 'SKILL.md.tmpl');
const sectionsDir = path.join(root, 'plan-tune', 'sections');
const source = fs.readFileSync(skillPath, 'utf-8');

const headings = {
  onboarding: '## Consent + opt-in',
  profile: '## Inspect profile',
  analytics: '## Stats',
  dream: '## Dream cycle review',
  rules: '## Important Rules',
};

const pos = Object.fromEntries(
  Object.entries(headings).map(([key, heading]) => [key, source.indexOf(heading)]),
) as Record<keyof typeof headings, number>;

for (const [key, value] of Object.entries(pos)) {
  if (value < 0) throw new Error(`Missing Plan Tune carve heading: ${key}`);
}
if (!(pos.onboarding < pos.profile && pos.profile < pos.analytics && pos.analytics < pos.dream && pos.dream < pos.rules)) {
  throw new Error('Plan Tune carve headings are out of order');
}

fs.mkdirSync(sectionsDir, { recursive: true });

let onboarding = source.slice(pos.onboarding, pos.profile).trimEnd() + '\n';
onboarding = onboarding.replace(
  '4. Show the profile inline as a confirmation (see `Inspect profile` below).',
  '4. Show the profile inline as a confirmation by loading the `profile-preferences` section and running `Inspect profile`.',
);

const profile = source.slice(pos.profile, pos.analytics).trimEnd() + '\n';
const analytics = source.slice(pos.analytics, pos.dream).trimEnd() + '\n';
const dream = source.slice(pos.dream, pos.rules).trimEnd() + '\n';

fs.writeFileSync(path.join(sectionsDir, 'onboarding.md.tmpl'), onboarding);
fs.writeFileSync(path.join(sectionsDir, 'profile-preferences.md.tmpl'), profile);
fs.writeFileSync(path.join(sectionsDir, 'analytics.md.tmpl'), analytics);
fs.writeFileSync(path.join(sectionsDir, 'dream-cycle.md.tmpl'), dream);

const manifest = {
  $schema: 'https://gstack.dev/schemas/section-manifest.json',
  skill: 'plan-tune',
  version: 1,
  note: 'ICM progressive loading: Step 0 routing stays eager; mutually exclusive Plan Tune flows load only after intent is resolved.',
  sections: [
    {
      id: 'onboarding',
      file: 'onboarding.md',
      title: 'Consent and initial 5-question setup',
      trigger: 'the consent gate or setup gate fires, or the user explicitly asks to run setup',
    },
    {
      id: 'profile-preferences',
      file: 'profile-preferences.md',
      title: 'Profile inspection, question log, preferences, declared-profile edits, and gap view',
      trigger: 'the routed intent is profile, vibe, question review, preference tuning, declared-profile editing, or gap inspection',
    },
    {
      id: 'analytics',
      file: 'analytics.md',
      title: 'Question-tuning stats, recent auto-decisions, and unmarked-question audit',
      trigger: 'the routed intent is stats, recent auto-decisions, or audit',
    },
    {
      id: 'dream-cycle',
      file: 'dream-cycle.md',
      title: 'Dream-cycle proposal review and free-text distillation',
      trigger: 'the dream-cycle gate fires or the user asks to distill or review dream-cycle proposals',
    },
  ],
};
fs.writeFileSync(path.join(sectionsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const routed = `{{SECTION_INDEX:plan-tune}}

## Routed flows

After Step 0 resolves intent, load only the section for the selected flow. Do not load unrelated flows.
Enable, disable, and ambiguity handling are fully specified in Step 0 and need no section read.

### Consent or setup

{{SECTION:onboarding}}

### Profile, question review, preferences, declared-profile edits, or gap

{{SECTION:profile-preferences}}

### Stats, recent auto-decisions, or unmarked-question audit

{{SECTION:analytics}}

### Dream cycle or distillation

{{SECTION:dream-cycle}}

---

`;

const rewritten = source.slice(0, pos.onboarding) + routed + source.slice(pos.rules);
fs.writeFileSync(skillPath, rewritten);

const guardsPath = path.join(root, 'test', 'helpers', 'carve-guards.ts');
let guards = fs.readFileSync(guardsPath, 'utf-8');
if (!guards.includes("'plan-tune': {")) {
  const anchor = "  'design-review': {\n";
  const at = guards.indexOf(anchor);
  if (at < 0) throw new Error('Could not find design-review carve guard anchor');
  const entry = `  'plan-tune': {
    skill: 'plan-tune',
    expectedSections: ['onboarding.md', 'profile-preferences.md', 'analytics.md', 'dream-cycle.md'],
    requiredReads: ['profile-preferences.md'],
    scenario:
      'Run /plan-tune for the plain-English request "show my profile" in SIMULATION. Treat question tuning as enabled, the setup gate as already satisfied, no pending dream-cycle proposals, and a populated declared profile. Do not execute bash or mutate files. Route from Step 0, read only the profile-preferences section, then describe the profile presentation and calibration behavior. Do NOT use AskUserQuestion.',
    staticInvariants: {
      mustStayInSkeleton: [
        '## Step 0: Detect what the user wants',
        'Consent gate',
        'Setup gate',
        'Dream-cycle gate',
        'question_tuning false',
        'question_tuning true',
        '## Important Rules',
        'One-way doors override never-ask',
      ],
      mustPrecedeStop: ['## Step 0: Detect what the user wants'],
      mustMoveToSection: [
        '## Consent + opt-in',
        '## 5-Q setup',
        '## Inspect profile',
        '## Stats',
        '## Dream cycle review',
      ],
      gateAfterStop: undefined,
    },
    behavioral: 'prompt',
    maxSkeletonBytes: 42_000,
    minUnionBytes: 55_000,
    mustContain: ['question tuning', 'developer profile', 'never-ask', 'Dream cycle', 'Plain English everywhere'],
  },
`;
  guards = guards.slice(0, at) + entry + guards.slice(at);
  fs.writeFileSync(guardsPath, guards);
}
