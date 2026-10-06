import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diffArduinoSource,
  extractRepairedArduinoSource,
  inferArduinoBoard,
  MAX_FIRMWARE_REPAIR_ATTEMPTS,
  normalizeArduinoSource,
  runFirmwareRepairLoop,
} from '../src/lib/agent/firmware-validation.ts';

test('normalizes HTML line-break artifacts from generated Arduino sketches', () => {
  const input = '<br>void setup() {<br>  pinMode(9, OUTPUT);<br>}<br>';
  assert.equal(normalizeArduinoSource(input), 'void setup() {\n  pinMode(9, OUTPUT);\n}');
});

test('detects an explicit ESP32 target before falling back to the generic Arduino board', () => {
  assert.equal(inferArduinoBoard('void setup() {} void loop() {}', ['esp32_devkit']).fqbn, 'esp32:esp32:esp32');
  assert.equal(inferArduinoBoard('void setup() { pinMode(9, OUTPUT); } void loop() {}').fqbn, 'arduino:avr:uno');
  assert.equal(inferArduinoBoard('print("hello")', ['raspberry_pi']), null);
});

test('extracts source from the repair model response without surrounding prose', () => {
  assert.equal(extractRepairedArduinoSource('```cpp\nvoid setup() {}\nvoid loop() {}\n```'), 'void setup() {}\nvoid loop() {}');
});

test('reports added and removed source lines with their respective line numbers', () => {
  assert.deepEqual(diffArduinoSource('int led = 9;\ndelay(10);', 'int led = 8;\ndelay(10);'), [
    { kind: 'removed', line: 1, text: 'int led = 9;' },
    { kind: 'added', line: 1, text: 'int led = 8;' },
  ]);
});

test('bounds automatic repair retries', () => {
  assert.equal(MAX_FIRMWARE_REPAIR_ATTEMPTS, 5);
});

test('recompiles model-repaired code and returns only after a passing build', async () => {
  const repaired = 'void setup() {}\nvoid loop() {}';
  const compileInputs = [];
  let repairs = 0;
  const outcome = await runFirmwareRepairLoop({
    initialSource: '<br>void setup() {<br>void loop() {}',
    compile: async source => {
      compileInputs.push(source);
      return source === repaired
        ? { ok: true, diagnostics: '', infrastructureFailure: false }
        : { ok: false, diagnostics: 'expected `}` before loop', infrastructureFailure: false };
    },
    repair: async (_source, diagnostics) => {
      repairs += 1;
      assert.match(diagnostics, /expected/);
      return repaired;
    },
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.source, repaired);
  assert.equal(outcome.repairAttempts, 1);
  assert.equal(repairs, 1);
  assert.equal(compileInputs.length, 2);
});

test('stops at the configured retry limit without claiming a successful build', async () => {
  let compileCount = 0;
  const outcome = await runFirmwareRepairLoop({
    initialSource: 'void setup() {}',
    compile: async () => {
      compileCount += 1;
      return { ok: false, diagnostics: 'still invalid', infrastructureFailure: false };
    },
    repair: async (source, _diagnostics, attempt) => `${source}\n// repair ${attempt}`,
  });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.repairAttempts, MAX_FIRMWARE_REPAIR_ATTEMPTS);
  assert.equal(compileCount, MAX_FIRMWARE_REPAIR_ATTEMPTS + 1);
});

test('does not ask the model to repair compiler infrastructure failures', async () => {
  let repairCount = 0;
  const outcome = await runFirmwareRepairLoop({
    initialSource: 'void setup() {}',
    compile: async () => ({ ok: false, diagnostics: 'missing board package', infrastructureFailure: true }),
    repair: async source => {
      repairCount += 1;
      return source;
    },
  });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.repairAttempts, 0);
  assert.equal(repairCount, 0);
});
