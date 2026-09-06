#!/usr/bin/env bun
import * as fs from 'fs';
import * as path from 'path';

const [baseRoot, headRoot, outputPath] = process.argv.slice(2);
if (!baseRoot || !headRoot || !outputPath) {
  console.error('usage: audit-codex-eager-context.ts <base-render> <head-render> <output.md>');
  process.exit(2);
}

type Row = {
  skill: string;
  baseTokens: number;
  headTokens: number;
  saved: number;
  pct: number;
};

function skillMap(root: string): Map<string, number> {
  const skillsDir = path.join(root, '.agents', 'skills');
  const out = new Map<string, number>();
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    const content = fs.readFileSync(skillPath, 'utf8');
    out.set(entry.name, Math.round(content.length / 4));
  }
  return out;
}

const base = skillMap(baseRoot);
const head = skillMap(headRoot);
const names = [...new Set([...base.keys(), ...head.keys()])].sort();
const rows: Row[] = names.map(skill => {
  const baseTokens = base.get(skill) ?? 0;
  const headTokens = head.get(skill) ?? 0;
  const saved = baseTokens - headTokens;
  const pct = baseTokens > 0 ? (saved / baseTokens) * 100 : 0;
  return { skill, baseTokens, headTokens, saved, pct };
});

const baseTotal = rows.reduce((n, r) => n + r.baseTokens, 0);
const headTotal = rows.reduce((n, r) => n + r.headTokens, 0);
const totalSaved = baseTotal - headTotal;
const totalPct = baseTotal ? (totalSaved / baseTotal) * 100 : 0;
const changed = rows.filter(r => r.saved !== 0).sort((a, b) => b.saved - a.saved);
const regressions = rows.filter(r => r.saved < 0).sort((a, b) => a.saved - b.saved);
const heavy = rows.filter(r => r.headTokens >= 10_000).sort((a, b) => b.headTokens - a.headTokens);
const topSavings = rows.filter(r => r.saved > 0).sort((a, b) => b.saved - a.saved).slice(0, 20);

const table = (items: Row[], mode: 'delta' | 'heavy') => {
  const lines = [
    '| Skill | Baseline eager | ICM eager | Saved | Reduction |',
    '|---|---:|---:|---:|---:|',
  ];
  for (const r of items) {
    lines.push(`| ${r.skill} | ${r.baseTokens.toLocaleString()} | ${r.headTokens.toLocaleString()} | ${r.saved.toLocaleString()} | ${r.pct.toFixed(1)}% |`);
  }
  return lines.join('\n');
};

const report = `# Codex ICM eager-context audit\n\n` +
`Baseline: fork main before ICM waves\n\n` +
`Comparison: icm-codex-context-wave-2\n\n` +
`Metric: generated Codex SKILL.md only. Deferred sections are excluded. Token counts use gstack's own generator estimate, Math.round(content.length / 4).\n\n` +
`## Whole-repo result\n\n` +
`- Baseline eager context: ${baseTotal.toLocaleString()} tokens\n` +
`- Current eager context: ${headTotal.toLocaleString()} tokens\n` +
`- Eager context deferred: ${totalSaved.toLocaleString()} tokens\n` +
`- Whole-repo reduction: ${totalPct.toFixed(1)}%\n` +
`- Skills measured: ${rows.length}\n` +
`- Skills reduced: ${rows.filter(r => r.saved > 0).length}\n` +
`- Skills unchanged: ${rows.filter(r => r.saved === 0).length}\n` +
`- Skills larger than baseline: ${regressions.length}\n\n` +
`## Largest eager-context reductions\n\n${table(topSavings, 'delta')}\n\n` +
`## Remaining skills at or above 10K eager tokens\n\n${table(heavy, 'heavy')}\n\n` +
`## Regressions\n\n` +
(regressions.length ? `${table(regressions, 'delta')}\n` : `None. No generated Codex SKILL.md is larger than its baseline.\n`) +
`\n## All changed skills\n\n${table(changed, 'delta')}\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, report);
console.log(report);
