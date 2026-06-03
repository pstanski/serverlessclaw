#!/usr/bin/env node
/**
 * EventBridge Pattern Linter
 * 
 * Validates that all EventBridge subscriptions have explicit event patterns
 * to prevent catch-all subscriptions that can cause event fanout amplification.
 * 
 * Usage:
 *   node scripts/ci/lint-eventbridge-patterns.js
 * 
 * Exit codes:
 *   0 = All EventBridge subscriptions have explicit patterns ✓
 *   1 = Violations found (catch-all patterns detected)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const WORKSPACE_ROOT = path.resolve(__dirname, '../../');
const PATTERNS_TO_CHECK = [
  'packages/**/*.ts',
  'packages/**/*.tsx',
  'apps/**/*.ts',
  'apps/**/*.tsx',
  'core/**/*.ts',
];

// Regex patterns to detect EventBridge subscriptions
const EVENTBRIDGE_PATTERNS = [
  /bus\.subscribe\s*\([^)]+\)/g,
  /eventBus\.subscribe\s*\([^)]+\)/g,
  /eventBridge\.putEvents\s*\([^)]+\)/g,
];

// Regex to detect event pattern configuration
const EVENT_PATTERN_REGEX = /pattern\s*:\s*{([^}]*?)}/;
const MISSING_PATTERN_REGEX = /bus\.subscribe\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,]+)\s*(?:,\s*{[^}]*})?(?:,\s*{[^}]*})?\s*\)/;

let violations = [];

/**
 * Search for TypeScript files in the workspace
 */
function findTypeScriptFiles() {
  try {
    const cmd = `find "${WORKSPACE_ROOT}" -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/dist/*" -not -path "*/.dist/*"`;
    const output = execSync(cmd, { encoding: 'utf-8', cwd: WORKSPACE_ROOT });
    return output.trim().split('\n').filter(f => f);
  } catch (error) {
    console.error('Error finding TypeScript files:', error.message);
    return [];
  }
}

/**
 * Check if a subscription has an explicit event pattern
 */
function hasExplicitPattern(subscriptionCode) {
  // Check for pattern object presence
  // Support multiple formats:
  // 1. pattern: { ... }
  // 2. pattern: { source: [...] }
  // 3. pattern: { detailType: [...] }
  // 4. pattern: { ...spread, detailType: [...] }
  
  if (!subscriptionCode.includes('pattern:')) {
    return false;
  }
  
  // Extract everything after 'pattern:'
  const patternStart = subscriptionCode.indexOf('pattern:');
  if (patternStart === -1) {
    return false;
  }
  
  // Find the opening brace
  const braceStart = subscriptionCode.indexOf('{', patternStart);
  if (braceStart === -1) {
    return false;
  }
  
  // Count braces to find the closing brace of the pattern object
  let braceCount = 1;
  let i = braceStart + 1;
  let patternContent = '';
  
  while (i < subscriptionCode.length && braceCount > 0) {
    const char = subscriptionCode[i];
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (braceCount > 0) patternContent += char;
    i++;
  }
  
  // Empty pattern object
  if (!patternContent.trim()) {
    return false;
  }
  
  // Check for catch-all patterns
  if (patternContent.includes('{"prefix":""}') || 
      patternContent.includes('{prefix:""}') ||
      patternContent.includes("'prefix': ''") ||
      patternContent.includes('"prefix": ""')) {
    return false;
  }
  
  // Check that pattern has at least source, detail-type, or detailType
  const hasSource = /\bsource\s*:/i.test(patternContent);
  const hasDetailType = /\b(detail-type|detailType)\s*:/i.test(patternContent);
  const hasSpreadOperator = patternContent.includes('...');
  
  // If using spread operator (like ...tenantFilter), assume it provides filtering
  if (hasSpreadOperator) {
    return true;
  }
  
  return hasSource || hasDetailType;
}

/**
 * Extract subscription details from code
 */
function extractSubscriptionDetails(code, filePath, lineNumber) {
  // Try to extract event name and function name
  const match = code.match(/bus\.subscribe\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)\s*(?:,\s*({[^}]*}))?/);
  
  if (match) {
    return {
      eventName: match[1],
      target: match[2],
      hasPattern: hasExplicitPattern(code),
      code: code.substring(0, 80) + '...',
    };
  }
  
  return null;
}

/**
 * Scan a single file for EventBridge subscriptions
 */
function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let fileViolations = [];
    
    // Simple line-by-line check for bus.subscribe
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line.includes('bus.subscribe') && !line.includes('eventBus.subscribe')) {
        continue;
      }
      
      // Multi-line subscription - collect context
      let subscriptionCode = line;
      let lineCount = 1;
      
      // Keep collecting lines until we find the closing parenthesis
      let openParens = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      let j = i + 1;
      
      while (openParens > 0 && j < lines.length && lineCount < 20) {
        subscriptionCode += '\n' + lines[j];
        openParens += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
        j++;
        lineCount++;
      }
      
      // Check if this subscription has an explicit pattern
      if (!hasExplicitPattern(subscriptionCode)) {
        const details = extractSubscriptionDetails(subscriptionCode, filePath, i + 1);
        if (details) {
          fileViolations.push({
            file: filePath,
            line: i + 1,
            eventName: details.eventName,
            target: details.target,
            code: details.code,
            message: `EventBridge subscription missing explicit pattern filter. This may cause catch-all behavior and event fanout amplification.`,
          });
        }
      }
    }
    
    return fileViolations;
  } catch (error) {
    console.warn(`Warning: Could not scan ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Main linting function
 */
function main() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  EventBridge Pattern Linter');
  console.log('════════════════════════════════════════════════════════════════\n');
  
  const files = findTypeScriptFiles();
  console.log(`Scanning ${files.length} TypeScript files...\n`);
  
  for (const filePath of files) {
    const fileViolations = scanFile(filePath);
    violations.push(...fileViolations);
  }
  
  // Report results
  if (violations.length === 0) {
    console.log('✓ All EventBridge subscriptions have explicit patterns\n');
    process.exit(0);
  }
  
  console.log(`✗ Found ${violations.length} violation(s):\n`);
  
  for (const v of violations) {
    const relativePath = path.relative(WORKSPACE_ROOT, v.file);
    console.log(`  ${relativePath}:${v.line}`);
    console.log(`    Event: ${v.eventName} → ${v.target}`);
    console.log(`    Issue: ${v.message}`);
    console.log(`    Code: ${v.code}\n`);
  }
  
  console.log('Fix Pattern:');
  console.log('  Add explicit event filtering to prevent catch-all subscriptions:\n');
  console.log('  ✗ BEFORE (catch-all - receives ALL events):');
  console.log('    bus.subscribe("EventName", functionArn);\n');
  console.log('  ✓ AFTER (explicit filter - receives only matching events):');
  console.log('    bus.subscribe("EventName", functionArn, {');
  console.log('      pattern: {');
  console.log('        source: ["your.event.source"],');
  console.log('        detailType: ["your_event_type"],');
  console.log('      },');
  console.log('    });\n');
  
  console.log('Documentation:');
  console.log('  See: docs/system/EVENTBRIDGE_BEST_PRACTICES.md\n');
  
  process.exit(1);
}

// Run linter
main();
