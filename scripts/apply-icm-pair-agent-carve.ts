import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(import.meta.dir, '..');
const skillPath = path.join(root, 'pair-agent', 'SKILL.md.tmpl');
const sectionsDir = path.join(root, 'pair-agent', 'sections');
const source = fs.readFileSync(skillPath, 'utf-8');

const remoteStart = source.indexOf('### If different machine (option B):');
const verifyStart = source.indexOf('## Step 5: Verify connection');
const referenceStart = source.indexOf('## What the remote agent can do');
if (remoteStart < 0 || verifyStart < 0 || referenceStart < 0 || !(remoteStart < verifyStart && verifyStart < referenceStart)) {
  throw new Error('Pair Agent carve headings missing or out of order');
}

fs.mkdirSync(sectionsDir, { recursive: true });
fs.writeFileSync(
  path.join(sectionsDir, 'remote-pairing.md.tmpl'),
  source.slice(remoteStart, verifyStart).trimEnd() + '\n',
);
fs.writeFileSync(
  path.join(sectionsDir, 'remote-reference.md.tmpl'),
  source.slice(referenceStart).trimEnd() + '\n',
);

const manifest = {
  $schema: 'https://gstack.dev/schemas/section-manifest.json',
  skill: 'pair-agent',
  version: 1,
  note: 'ICM progressive loading: local-vs-remote routing and destructive daemon consent stay eager; remote tunnel setup and reference guidance load only when relevant.',
  sections: [
    {
      id: 'remote-pairing',
      file: 'remote-pairing.md',
      title: 'Remote pairing, ngrok consent, authentication, and instruction-block flow',
      trigger: 'Step 3 resolves to a different-machine remote agent',
    },
    {
      id: 'remote-reference',
      file: 'remote-reference.md',
      title: 'Remote permissions, troubleshooting, platform notes, and revocation',
      trigger: 'the user asks about paired-agent capabilities, restrictions, troubleshooting, platform-specific behavior, or revoking access',
    },
  ],
};
fs.writeFileSync(path.join(sectionsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const remotePointer = `### If different machine (option B):\n\n{{SECTION:remote-pairing}}\n\n`;
const referencePointer = `## Remote pairing reference\n\nThe normal pairing flow ends after Step 5 verification. Load the reference section only when the user asks about capabilities, restrictions, troubleshooting, platform-specific behavior, or revoking access.\n\n{{SECTION:remote-reference}}\n`;

let rewritten = source.slice(0, remoteStart) + remotePointer + source.slice(verifyStart, referenceStart) + referencePointer;
rewritten = rewritten.replace('## Step 4: Execute pairing\n', '{{SECTION_INDEX:pair-agent}}\n\n## Step 4: Execute pairing\n');
fs.writeFileSync(skillPath, rewritten);

const guardsPath = path.join(root, 'test', 'helpers', 'carve-guards.ts');
let guards = fs.readFileSync(guardsPath, 'utf-8');
if (!guards.includes("'pair-agent': {")) {
  const anchor = "  'qa-only': {\n";
  const at = guards.indexOf(anchor);
  if (at < 0) throw new Error('Could not find qa-only carve guard anchor');
  const entry = `  'pair-agent': {
    skill: 'pair-agent',
    expectedSections: ['remote-pairing.md', 'remote-reference.md'],
    requiredReads: ['remote-pairing.md'],
    scenario:
      'Walk /pair-agent in SIMULATION for pairing Hermes on a different machine. Treat the browser daemon as running and the user as choosing to keep it, pair-agent consent as already on, and ngrok as installed and authenticated. Do not execute commands or expose real credentials. Read the remote pairing section, then state the command and instruction-block handling you would perform. Do not load the remote reference section unless needed.',
    staticInvariants: {
      mustStayInSkeleton: [
        '## Step 1: Check prerequisites',
        '## Step 2: Ask what they want',
        '## Step 3: Local or remote?',
        'Live-daemon consent (one-way door)',
        '### If same machine (option A):',
        '## Step 5: Verify connection',
      ],
      mustPrecedeStop: ['## Step 2: Ask what they want', '## Step 3: Local or remote?', 'Live-daemon consent (one-way door)'],
      mustMoveToSection: [
        'Consent gate (once per machine)',
        'NGROK_INSTALLED',
        'CRITICAL: You MUST output the full instruction block',
        '## What the remote agent can do',
        '## Troubleshooting',
        '## Revoking access',
      ],
      gateAfterStop: undefined,
    },
    behavioral: 'prompt',
    maxSkeletonBytes: 39_000,
    minUnionBytes: 43_000,
    mustContain: ['pair-agent', 'ngrok', '--restrict', '--control', 'tunnel revoke', 'setup key'],
    maxSizeRatio: 1.08,
  },
`;
  guards = guards.slice(0, at) + entry + guards.slice(at);
  fs.writeFileSync(guardsPath, guards);
}
