#!/usr/bin/env bun
import * as fs from 'fs';
import { execSync } from 'child_process';

const oursGuardsPath = process.argv[2];
if (!oursGuardsPath) throw new Error('usage: resolve-icm-v181-merge.ts <saved-ours-carve-guards>');

function gitShow(spec: string): string {
  return execSync(`git show ${spec}`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function findEntry(text: string, key: string): { start: number; end: number; text: string } {
  const quoted = `  '${key}': {`;
  const bare = `  ${key}: {`;
  let start = text.indexOf(quoted);
  if (start < 0) start = text.indexOf(bare);
  if (start < 0) throw new Error(`guard entry not found: ${key}`);

  const nextRe = /\n  (?:'[^']+'|[A-Za-z0-9_-]+): \{/g;
  nextRe.lastIndex = start + 1;
  const match = nextRe.exec(text);
  const end = match ? match.index + 1 : text.indexOf('\n};', start);
  if (end < 0) throw new Error(`guard entry end not found: ${key}`);
  return { start, end, text: text.slice(start, end) };
}

function replaceEntry(base: string, key: string, replacement: string): string {
  const cur = findEntry(base, key);
  return base.slice(0, cur.start) + replacement.trimEnd() + '\n' + base.slice(cur.end);
}

function tuneEntry(entry: string, key: string): string {
  let out = entry;
  const replaceBudget = (value: string) => {
    out = out.replace(/maxSkeletonBytes:\s*[0-9_]+[^\n]*/, `maxSkeletonBytes: ${value},`);
  };

  if (key === 'ship') {
    replaceBudget('79_300');
    out = out.replace(/maxSizeRatio:\s*[0-9.]+,?[^\n]*/, 'maxSizeRatio: 1.24,');
  } else if (key === 'plan-ceo-review') {
    replaceBudget('79_000');
    out = out.replace(/maxSizeRatio:\s*[0-9.]+,?[^\n]*/, 'maxSizeRatio: 1.12,');
  } else if (key === 'design-review') {
    replaceBudget('90_000');
    if (!out.includes('maxSizeRatio:')) out = out.replace(/\n  },\s*$/, '\n    maxSizeRatio: 1.12,\n  },');
  } else if (key === 'qa-only') {
    replaceBudget('65_000');
    if (!out.includes('maxSizeRatio:')) out = out.replace(/\n  },\s*$/, '\n    maxSizeRatio: 1.12,\n  },');
  }
  return out;
}

// 1. Rebuild DevEx from the v1.81 Aside-first source, preserving the ICM carve.
const mainDevex = gitShow('origin/main:devex-review/SKILL.md.tmpl');
const auditStart = mainDevex.indexOf('## Step 1: Getting Started Audit');
const auditEnd = mainDevex.indexOf('## Review Log');
if (auditStart < 0 || auditEnd < 0 || auditEnd <= auditStart) {
  throw new Error('Could not locate v1.81 DevEx audit block');
}
const auditBody = mainDevex.slice(auditStart, auditEnd).trimEnd();
let devexSkeleton = mainDevex.replace('{{DX_FRAMEWORK}}\n\n', '');
const skeletonAuditStart = devexSkeleton.indexOf('## Step 1: Getting Started Audit');
const skeletonAuditEnd = devexSkeleton.indexOf('## Review Log');
devexSkeleton =
  devexSkeleton.slice(0, skeletonAuditStart) +
  '## Steps 1-8: Live DX Audit\n\n{{SECTION:audit-playbook}}\n\n' +
  devexSkeleton.slice(skeletonAuditEnd);
const step0 = '## Step 0: Target Discovery';
if (!devexSkeleton.includes('{{SECTION_INDEX:devex-review}}')) {
  devexSkeleton = devexSkeleton.replace(step0, '{{SECTION_INDEX:devex-review}}\n\n' + step0);
}
fs.writeFileSync('devex-review/SKILL.md.tmpl', devexSkeleton);
fs.mkdirSync('devex-review/sections', { recursive: true });
fs.writeFileSync('devex-review/sections/audit-playbook.md.tmpl', `{{DX_FRAMEWORK}}\n\n${auditBody}\n`);

// 2. Start the shared carve registry from v1.81 main so every upstream Aside budget
// and invariant survives. Reapply only the ICM entries changed by this branch.
let guards = gitShow('origin/main:test/helpers/carve-guards.ts');
const ours = fs.readFileSync(oursGuardsPath, 'utf8');

for (const key of ['ship', 'plan-ceo-review', 'retro']) {
  const entry = tuneEntry(findEntry(ours, key).text, key);
  guards = replaceEntry(guards, key, entry);
}

const additions = ['plan-tune', 'design-review', 'document-generate', 'pair-agent', 'qa-only'];
const insertionAnchor = '  // ── Token-reduction Phase 4 wave 3';
const insertionAt = guards.indexOf(insertionAnchor);
if (insertionAt < 0) throw new Error('Could not locate carve registry insertion point');
const addedText =
  '  // ── Ace-Pi ICM Codex wave 2 ─────────────────────────────────────────────\n' +
  additions.map(key => tuneEntry(findEntry(ours, key).text, key).trimEnd()).join('\n') +
  '\n';
guards = guards.slice(0, insertionAt) + addedText + guards.slice(insertionAt);
fs.writeFileSync('test/helpers/carve-guards.ts', guards);

console.log('Resolved v1.81 merge: DevEx Aside-first carve + ICM carve registry ported.');
