#!/usr/bin/env node

/* global process, console */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

function findTypeScriptFiles() {
  const cmd = `rg --files -g "**/*.ts" -g "**/*.tsx" -g "!**/*.test.ts" -g "!**/*.test.tsx" -g "!**/*.spec.ts" -g "!**/*.spec.tsx" -g "!**/node_modules/**" -g "!**/.next/**" -g "!**/dist/**" -g "!**/.dist/**"`;
  const output = execSync(cmd, { encoding: 'utf-8', cwd: WORKSPACE_ROOT });
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((f) => path.join(WORKSPACE_ROOT, f));
}

function hasExplicitPattern(subscriptionCode) {
  if (!subscriptionCode.includes('pattern:')) return false;

  const patternStart = subscriptionCode.indexOf('pattern:');
  const braceStart = subscriptionCode.indexOf('{', patternStart);
  if (braceStart === -1) return false;

  let braceCount = 1;
  let i = braceStart + 1;
  let patternContent = '';

  while (i < subscriptionCode.length && braceCount > 0) {
    const ch = subscriptionCode[i];
    if (ch === '{') braceCount += 1;
    if (ch === '}') braceCount -= 1;
    if (braceCount > 0) patternContent += ch;
    i += 1;
  }

  if (!patternContent.trim()) return false;

  if (
    patternContent.includes('{"prefix":""}') ||
    patternContent.includes('{prefix:""}') ||
    patternContent.includes("'prefix': ''") ||
    patternContent.includes('"prefix": ""')
  ) {
    return false;
  }

  const hasSource = /\bsource\s*:/i.test(patternContent);
  const hasDetailType = /\b(detail-type|detailType)\s*:/i.test(patternContent);
  const hasSpread = patternContent.includes('...');

  return hasSource || hasDetailType || hasSpread;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes('bus.subscribe') && !line.includes('eventBus.subscribe')) continue;

    let subscriptionCode = line;
    let openParens = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    let j = i + 1;
    let lineCount = 1;

    while (openParens > 0 && j < lines.length && lineCount < 30) {
      subscriptionCode += `\n${lines[j]}`;
      openParens += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
      j += 1;
      lineCount += 1;
    }

    if (!hasExplicitPattern(subscriptionCode)) {
      const m = subscriptionCode.match(/subscribe\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,\s)]+)/);
      violations.push({
        file: filePath,
        line: i + 1,
        eventName: m?.[1] || 'unknown',
        target: m?.[2] || 'unknown',
      });
    }
  }

  return violations;
}

function main() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  EventBridge Pattern Linter');
  console.log('════════════════════════════════════════════════════════════════\n');

  const files = findTypeScriptFiles();
  console.log(`Scanning ${files.length} TypeScript files...\n`);

  const violations = [];
  for (const file of files) {
    try {
      violations.push(...scanFile(file));
    } catch {
      // ignore unreadable files
    }
  }

  if (violations.length === 0) {
    console.log('✓ All EventBridge subscriptions have explicit patterns\n');
    process.exit(0);
  }

  console.log(`✗ Found ${violations.length} violation(s):\n`);
  for (const v of violations) {
    const rel = path.relative(WORKSPACE_ROOT, v.file);
    console.log(`  ${rel}:${v.line}`);
    console.log(`    Event: ${v.eventName} -> ${v.target}`);
    console.log('    Issue: EventBridge subscription missing explicit pattern filter.\n');
  }

  process.exit(1);
}

main();
