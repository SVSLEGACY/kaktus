// @ts-nocheck -- ported as-is from the original kaktus app
import type { AgentStep } from './protocol.ts';

export interface CodeQualityFinding {
  stepNumber: number;
  message: string;
}

function hasPlaceholderMarker(code: string): boolean {
  return code.split(/\r?\n/).some(line =>
    /(?:\/\/|\/\*|\*|#)\s*(?:TODO|FIXME|TBD|IMPLEMENTATION OMITTED|REST OF CODE|CODE GOES HERE)\b/i.test(line)
      || /\b(?:IMPLEMENTATION OMITTED|REST OF CODE|CODE GOES HERE)\b/i.test(line)
      || /^(?:\.\.\.|…)\s*$/.test(line.trim()),
  );
}

function hasUnbalancedDelimiters(source: string): boolean {
  const stack: string[] = [];
  let state: 'code' | 'line-comment' | 'block-comment' | 'single-quote' | 'double-quote' = 'code';
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === 'line-comment') {
      if (char === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'code';
        index += 1;
      }
      continue;
    }
    if (state === 'single-quote' || state === 'double-quote') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if ((state === 'single-quote' && char === "'") || (state === 'double-quote' && char === '"')) state = 'code';
      continue;
    }

    if (char === '/' && next === '/') {
      state = 'line-comment';
      index += 1;
    } else if (char === '/' && next === '*') {
      state = 'block-comment';
      index += 1;
    } else if (char === "'") {
      state = 'single-quote';
    } else if (char === '"') {
      state = 'double-quote';
    } else if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else if (char === ')' || char === ']' || char === '}') {
      const expected = char === ')' ? '(' : char === ']' ? '[' : '{';
      if (stack.pop() !== expected) return true;
    }
  }

  return stack.length > 0 || state === 'block-comment' || state === 'single-quote' || state === 'double-quote';
}

export function reviewGeneratedCode(steps: readonly AgentStep[]): CodeQualityFinding[] {
  const findings: CodeQualityFinding[] = [];

  steps.forEach((step, index) => {
    if (typeof step.code !== 'string' || !step.code.trim()) return;

    const code = step.code.replace(/```[\w-]*\s*/g, '').replace(/```/g, '').trim();
    const language = `${step.code_language || ''} ${code.slice(0, 200)}`;
    const isCpp = /\b(?:cpp|c|arduino|ino)\b|c\+\+|#\s*include\s*[<"]Arduino\.h/i.test(language);

    if (hasPlaceholderMarker(code)) {
      findings.push({ stepNumber: index + 1, message: 'Possible placeholder or omitted implementation remains in this code block.' });
    }

    if (isCpp && hasUnbalancedDelimiters(code)) {
      findings.push({ stepNumber: index + 1, message: 'C/C++ delimiters or quotes do not balance; the code may be truncated or intentionally partial.' });
    }

    if (isCpp && /\b(?:void\s+)?setup\s*\(/i.test(code) !== /\b(?:void\s+)?loop\s*\(/i.test(code)) {
      findings.push({ stepNumber: index + 1, message: 'This looks like an Arduino sketch with only setup() or loop(); confirm whether the code block is intentionally partial.' });
    }
  });

  return findings;
}
