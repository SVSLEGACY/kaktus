export const MAX_FIRMWARE_REPAIR_ATTEMPTS = 5;

export type SupportedArduinoBoard = {
  fqbn: string;
  name: string;
};

export type FirmwareDiffLine = {
  kind: 'added' | 'removed';
  line: number;
  text: string;
};

export interface FirmwareCompileResult {
  ok: boolean;
  diagnostics: string;
  infrastructureFailure: boolean;
}

export async function runFirmwareRepairLoop({
  initialSource,
  compile,
  repair,
  onRepairAttempt,
  maxAttempts = MAX_FIRMWARE_REPAIR_ATTEMPTS,
}: {
  initialSource: string;
  compile: (source: string) => Promise<FirmwareCompileResult>;
  repair: (source: string, diagnostics: string, attempt: number) => Promise<string>;
  onRepairAttempt?: (attempt: number) => void;
  maxAttempts?: number;
}): Promise<{ ok: boolean; source: string; repairAttempts: number; result: FirmwareCompileResult }> {
  let source = normalizeArduinoSource(initialSource);
  let result = await compile(source);
  let repairAttempts = 0;

  while (!result.ok && !result.infrastructureFailure && repairAttempts < maxAttempts) {
    repairAttempts += 1;
    onRepairAttempt?.(repairAttempts);
    const repairedSource = normalizeArduinoSource(await repair(source, result.diagnostics, repairAttempts));
    if (!repairedSource || repairedSource === source) break;
    source = repairedSource;
    result = await compile(source);
  }

  return { ok: result.ok, source, repairAttempts, result };
}

const BOARDS: SupportedArduinoBoard[] = [
  { fqbn: 'arduino:avr:uno', name: 'Arduino Uno' },
  { fqbn: 'arduino:avr:nano', name: 'Arduino Nano' },
  { fqbn: 'arduino:avr:mega', name: 'Arduino Mega' },
  { fqbn: 'esp32:esp32:esp32', name: 'ESP32 Dev Module' },
  { fqbn: 'esp32:esp32:esp32s3', name: 'ESP32-S3' },
  { fqbn: 'esp32:esp32:esp32c3', name: 'ESP32-C3' },
];

export function normalizeArduinoSource(source: string): string {
  return source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n?/g, '\n')
    .trim();
}

export function inferArduinoBoard(source: string, componentTypes: string[] = []): SupportedArduinoBoard | null {
  const evidence = `${componentTypes.join(' ')}\n${source}`.toLowerCase();

  if (/esp32[-_ ]?s3|esp32s3/.test(evidence)) return BOARDS[4];
  if (/esp32[-_ ]?c3|esp32c3/.test(evidence)) return BOARDS[5];
  if (/esp32(?:[_ -]|\b)|\bespressif\b|#include\s*[<"](?:wifi|esp_)/i.test(evidence)) return BOARDS[3];
  if (/arduino[_ -]?mega|\bmega\s*2560\b/.test(evidence)) return BOARDS[2];
  if (/arduino[_ -]?nano|\bnano\b/.test(evidence)) return BOARDS[1];
  if (/arduino[_ -]?uno|\buno\b/.test(evidence)) return BOARDS[0];

  // A plain setup()/loop() sketch with Arduino core APIs is conventionally Uno-targeted.
  if (/\bvoid\s+setup\s*\(/.test(source) && /\bvoid\s+loop\s*\(/.test(source)
    && /\b(?:pinMode|digitalWrite|analogRead|Serial\.begin)\s*\(/.test(source)) {
    return BOARDS[0];
  }
  return null;
}

export function extractRepairedArduinoSource(response: string): string {
  const fenced = response.match(/```(?:ino|arduino|cpp|c\+\+|c)?\s*([\s\S]*?)```/i);
  const candidate = normalizeArduinoSource(fenced?.[1] ?? response);
  return candidate.replace(/^```[^\n]*\n?|```$/g, '').trim();
}

export function diffArduinoSource(before: string, after: string): FirmwareDiffLine[] {
  const oldLines = before.split('\n');
  const newLines = after.split('\n');

  // Keep the LCS table bounded for unusually large generated files.
  if (oldLines.length * newLines.length > 40_000) {
    let prefix = 0;
    while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1;
    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while (oldEnd >= prefix && newEnd >= prefix && oldLines[oldEnd] === newLines[newEnd]) {
      oldEnd -= 1;
      newEnd -= 1;
    }
    return [
      ...oldLines.slice(prefix, oldEnd + 1).map((text, index) => ({ kind: 'removed' as const, line: prefix + index + 1, text })),
      ...newLines.slice(prefix, newEnd + 1).map((text, index) => ({ kind: 'added' as const, line: prefix + index + 1, text })),
    ];
  }

  const lcs = Array.from({ length: oldLines.length + 1 }, () => new Uint32Array(newLines.length + 1));
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      lcs[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? lcs[oldIndex + 1][newIndex + 1] + 1
        : Math.max(lcs[oldIndex + 1][newIndex], lcs[oldIndex][newIndex + 1]);
    }
  }

  const changes: FirmwareDiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      oldIndex += 1;
      newIndex += 1;
    } else if (lcs[oldIndex + 1][newIndex] >= lcs[oldIndex][newIndex + 1]) {
      changes.push({ kind: 'removed', line: oldIndex + 1, text: oldLines[oldIndex] });
      oldIndex += 1;
    } else {
      changes.push({ kind: 'added', line: newIndex + 1, text: newLines[newIndex] });
      newIndex += 1;
    }
  }
  while (oldIndex < oldLines.length) {
    changes.push({ kind: 'removed', line: oldIndex + 1, text: oldLines[oldIndex++] });
  }
  while (newIndex < newLines.length) {
    changes.push({ kind: 'added', line: newIndex + 1, text: newLines[newIndex++] });
  }
  return changes;
}
