import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(import.meta.dir, '..');
const skillPath = path.join(root, 'ship', 'SKILL.md.tmpl');
const sectionsDir = path.join(root, 'ship', 'sections');
const manifestPath = path.join(sectionsDir, 'manifest.json');
const guardsPath = path.join(root, 'test', 'helpers', 'carve-guards.ts');

let source = fs.readFileSync(skillPath, 'utf-8');
fs.mkdirSync(sectionsDir, { recursive: true });

function carve(startMarker: string, endMarker: string, file: string, replacement: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Missing Ship carve markers for ${file}`);
  fs.writeFileSync(path.join(sectionsDir, file), source.slice(start, end).trimEnd() + '\n');
  source = source.slice(0, start) + replacement + source.slice(end);
}

carve(
  '## Step 2: Distribution Pipeline Check',
  '## Step 3: Merge the base branch (BEFORE tests)',
  'distribution-pipeline.md.tmpl',
  `## Step 2: Distribution Pipeline Check\n\nInspect the diff for a newly introduced standalone distributable artifact such as a CLI binary, library package, or tool. Web services with an existing deployment path do not count.\n\nIf a new standalone artifact is present, load and execute the distribution-pipeline section. Otherwise skip directly to Step 3.\n\n{{SECTION:distribution-pipeline}}\n\n---\n\n`,
);

carve(
  '### Step 15.0: WIP Commit Squash (continuous checkpoint mode only)',
  '### Step 15.1: Bisectable Commits',
  'wip-squash.md.tmpl',
  `### Step 15.0: WIP Commit Squash (continuous checkpoint mode only)\n\nOnly applies when \`CHECKPOINT_MODE\` is \`continuous\`. Detect WIP commits first:\n\n\`\`\`bash\nWIP_COUNT=$(git log <base>..HEAD --oneline --grep="^WIP:" 2>/dev/null | wc -l | tr -d ' ')\necho "WIP_COMMITS: $WIP_COUNT"\n\`\`\`\n\nIf \`WIP_COUNT\` is 0, skip this sub-step. If it is greater than 0, load the WIP-squash section before changing history.\n\n{{SECTION:wip-squash}}\n\n`,
);

const prepushStart = source.indexOf('**Credential pre-push guard (#1946) — run before the push:**');
const prepushEnd = source.indexOf('**Idempotency check:** Check if the branch is already pushed and up to date.', prepushStart);
if (prepushStart < 0 || prepushEnd < 0) throw new Error('Missing Ship pre-push carve markers');
fs.writeFileSync(
  path.join(sectionsDir, 'prepush-credential-setup.md.tmpl'),
  source.slice(prepushStart, prepushEnd).trimEnd() + '\n',
);
const prepushReplacement = `**Credential pre-push guard (#1946) — detect before the push:**\n\nRun the lightweight state check below before deciding whether setup detail is needed:\n\n\`\`\`bash\n_REDACT_PREPUSH=$(~/.claude/skills/gstack/bin/gstack-config get redact_prepush_hook 2>/dev/null || echo "false")\n_HOOK_PATH=$(git rev-parse --git-path hooks/pre-push 2>/dev/null || echo "")\n_HOOK_INSTALLED="no"\n[ -n "$_HOOK_PATH" ] && [ -f "$_HOOK_PATH" ] && grep -q "gstack-redact" "$_HOOK_PATH" 2>/dev/null && _HOOK_INSTALLED="yes"\n_PREPUSH_PROMPTED=$([ -f "\${GSTACK_HOME:-$HOME/.gstack}/.redact-prepush-prompted" ] && echo "yes" || echo "no")\necho "REDACT_PREPUSH: $_REDACT_PREPUSH"\necho "HOOK_INSTALLED: $_HOOK_INSTALLED"\necho "PREPUSH_PROMPTED: $_PREPUSH_PROMPTED"\n\`\`\`\n\nIf the hook is already installed, continue to the idempotency check. If setup, installation, custom-hooks-path handling, or the one-time consent prompt is needed, load and execute the pre-push credential section.\n\n{{SECTION:prepush-credential-setup}}\n\n`;
source = source.slice(0, prepushStart) + prepushReplacement + source.slice(prepushEnd);

carve(
  '## Step 21: Plan-tune discoverability nudge (first-successful-ship only)',
  '## Section self-check (before you finish)',
  'plan-tune-nudge.md.tmpl',
  `## Step 21: Plan-tune discoverability nudge (first-successful-ship only)\n\nCheck eligibility without loading the nudge body:\n\n\`\`\`bash\n_NUDGE_MARKER="$HOME/.gstack/.plan-tune-nudge-shown"\n_QT=$(~/.claude/skills/gstack/bin/gstack-config get question_tuning 2>/dev/null || echo "false")\n[ ! -f "$_NUDGE_MARKER" ] && [ "$_QT" = "false" ] && echo "PLAN_TUNE_NUDGE: eligible" || echo "PLAN_TUNE_NUDGE: skip"\n\`\`\`\n\nOnly when eligible, load and execute the nudge section. Otherwise continue to the section self-check.\n\n{{SECTION:plan-tune-nudge}}\n\n---\n\n`,
);

fs.writeFileSync(skillPath, source);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const additions = [
  { id: 'distribution-pipeline', file: 'distribution-pipeline.md', title: 'Standalone artifact distribution-pipeline check and missing-pipeline decision', trigger: 'Step 2 detects a new standalone distributable artifact' },
  { id: 'wip-squash', file: 'wip-squash.md', title: 'Continuous-checkpoint WIP commit squash strategy and anti-footgun rules', trigger: 'Step 15 detects WIP commits while CHECKPOINT_MODE is continuous' },
  { id: 'prepush-credential-setup', file: 'prepush-credential-setup.md', title: 'Credential pre-push hook installation, custom hooks-path handling, and one-time consent', trigger: 'Step 17 detects that credential-hook setup or consent handling is needed' },
  { id: 'plan-tune-nudge', file: 'plan-tune-nudge.md', title: 'First-successful-ship Plan Tune discoverability nudge', trigger: 'Step 21 finds no nudge marker and question tuning is disabled' },
];
for (const add of additions) {
  if (!manifest.sections.some((s: any) => s.id === add.id)) manifest.sections.push(add);
}
manifest.note = 'ICM progressive loading: core ship verification and release flow stays eager/phase-loaded; conditional setup and uncommon branches load only when their runtime predicate fires.';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

let guards = fs.readFileSync(guardsPath, 'utf-8');
const start = guards.indexOf('  ship: {');
const end = guards.indexOf("\n  'plan-ceo-review': {", start);
if (start < 0 || end < 0) throw new Error('Could not locate Ship carve guard');
const replacement = `  ship: {
    skill: 'ship',
    expectedSections: [
      'apple-release.md',
      'tests.md',
      'test-coverage.md',
      'plan-completion.md',
      'review-army.md',
      'greptile.md',
      'adversarial.md',
      'changelog.md',
      'pr-body.md',
      'distribution-pipeline.md',
      'wip-squash.md',
      'prepush-credential-setup.md',
      'plan-tune-nudge.md',
    ],
    requiredReads: ['review-army.md', 'changelog.md'],
    scenario:
      'This is a FRESH version-changing ship with no standalone artifact, no WIP commits, an already-installed credential hook, and an existing plan-tune nudge marker. Run the normal ship verification path through pre-landing review and CHANGELOG preparation. Do not load the four conditional sections. Do NOT actually commit, push, or open a PR.',
    staticInvariants: {
      mustStayInSkeleton: [
        'v$NEW_VERSION',
        'gstack-pr-title-rewrite',
        'dispatching the /document-release subagent to sync docs',
        'dispatch the /document-release subagent to sync docs',
        'dispatches the /document-release subagent',
        '## Step 2: Distribution Pipeline Check',
        '### Step 15.0: WIP Commit Squash',
        'Credential pre-push guard (#1946) — detect before the push',
        '## Step 21: Plan-tune discoverability nudge',
      ],
      mustMoveToSection: [
        'gh pr create --base',
        'gh pr edit --title',
        'Dispatch /document-release as a subagent',
        "This PR adds a new binary/tool but there's no CI/CD pipeline",
        'Non-destructive squash strategy',
        'gstack can install a per-repo git pre-push hook',
        'gstack can learn from your AskUserQuestion answers',
      ],
      gateAfterStop: undefined,
    },
    behavioral: 'external',
    externalTest: 'test/skill-e2e-ship-section-loading.test.ts',
    maxSkeletonBytes: 72_500,
    minUnionBytes: 181_000,
    mustContain: ['VERSION', 'CHANGELOG', 'review', 'merge', 'PR'],
    maxSizeRatio: 1.24,
  },`;
guards = guards.slice(0, start) + replacement + guards.slice(end);
fs.writeFileSync(guardsPath, guards);
