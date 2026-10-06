import test from 'node:test';
import assert from 'node:assert/strict';
import { insertStepsAfter, isCanvasMutationRequest, routeExplicitStepEdit, routePlanPhase } from '../src/lib/agent/workspace.ts';
import { buildHardwareStudioSystemPrompt } from '../src/lib/agent/system-prompt.ts';
import { validateAgentPlan } from '../src/lib/agent/protocol.ts';
import { reviewGeneratedCode } from '../src/lib/agent/code-quality.ts';
import { chooseDefaultAgentModel } from '../src/lib/agent/models.ts';
import { toGeminiImagePart } from '../src/lib/agent/client.ts';
import { imageAttachmentDataUrl, isImageAttachment } from '../src/lib/agent/image-attachments.ts';

const step = (instruction, insert_after_step) => ({ instruction, insert_after_step });

test('inserts after the UI step number and preserves existing order', () => {
  const existing = [step('A'), step('B'), step('C'), step('D')];
  const result = insertStepsAfter(existing, [step('B-test', 2)]);
  assert.deepEqual(result.steps.map(item => item.instruction), ['A', 'B', 'B-test', 'C', 'D']);
  assert.equal(result.firstInsertedIndex, 2);
});

test('keeps a multi-step insertion in order at one anchor', () => {
  const result = insertStepsAfter([step('A'), step('B')], [step('test 1', 1), step('test 2', 1)]);
  assert.deepEqual(result.steps.map(item => item.instruction), ['A', 'test 1', 'test 2', 'B']);
});

test('supports insertion before the first step and appending by default', () => {
  const result = insertStepsAfter([step('A'), step('B')], [step('setup', 0), step('finish')]);
  assert.deepEqual(result.steps.map(item => item.instruction), ['setup', 'A', 'B', 'finish']);
  assert.equal(result.firstInsertedIndex, 0);
});

test('clamps an anchor beyond the current step list to the end', () => {
  const result = insertStepsAfter([step('A')], [step('last', 99)]);
  assert.deepEqual(result.steps.map(item => item.instruction), ['A', 'last']);
});

test('replaces only the explicitly numbered step and focuses its original position', () => {
  const existing = [step('wire power'), step('old continuity check'), step('wire control')];
  const result = insertStepsAfter(existing, [{ instruction: 'corrected continuity check', replace_step: 2 }]);
  assert.deepEqual(result.steps.map(item => item.instruction), ['wire power', 'corrected continuity check', 'wire control']);
  assert.equal(result.steps[1].replace_step, undefined);
  assert.equal(result.firstInsertedIndex, 1);
});

test('ignores invalid replacement ordinals without changing the existing steps', () => {
  const existing = [step('A'), step('B')];
  const result = insertStepsAfter(existing, [{ instruction: 'wrong replacement', replace_step: 3 }]);
  assert.deepEqual(result.steps, existing);
});

test('routes a new approved subsystem into a specifically named tab', () => {
  const result = routePlanPhase({ steps: [step('power wiring')] }, 'Power System', ['Main Assembly', 'Chassis']);
  assert.equal(result.action, 'NEW_TAB');
  assert.equal(result.target_tab, 'Power System');
});

test('updates an existing subsystem tab instead of duplicating it', () => {
  const result = routePlanPhase({ steps: [step('more power wiring')] }, 'Power System', ['power system']);
  assert.equal(result.action, 'UPDATE_CURRENT');
  assert.equal(result.target_tab, 'Power System');
});

test('routes an explicit step-N insertion to the active tab and overrides model append intent', () => {
  const result = routeExplicitStepEdit(
    { action: 'NEW_PROJECT', target_tab: 'Main Assembly', steps: [step('continuity test', 99)] },
    'Add a test immediately after the currently selected step 2.',
    'Motor Control Electronics',
    2,
  );
  assert.equal(result.action, 'UPDATE_CURRENT');
  assert.equal(result.target_tab, 'Motor Control Electronics');
  assert.equal(result.steps[0].insert_after_step, 2);
});

test('uses the visible current step when the request says after this step', () => {
  const result = routeExplicitStepEdit(
    { steps: [step('test')] },
    'Add a verification step after this step.',
    'Power System',
    8,
  );
  assert.equal(result.steps[0].insert_after_step, 8);
});

test('routes a Hinglish step insertion after the visible step into the active tab', () => {
  const result = routeExplicitStepEdit(
    { action: 'NEW_PROJECT', target_tab: 'Main Assembly', steps: [step('Add a functional test')] },
    'iss step ke baad ek testing step add karna',
    'Motor Control Electronics',
    4,
  );
  assert.equal(result.action, 'UPDATE_CURRENT');
  assert.equal(result.target_tab, 'Motor Control Electronics');
  assert.equal(result.steps[0].insert_after_step, 4);
});

test('routes a numbered Hinglish insertion to that explicit step', () => {
  const result = routeExplicitStepEdit(
    { action: 'NEW_PROJECT', steps: [step('Add a functional test')] },
    'step 3 ke baad test step add karna',
    'Main Assembly',
    7,
  );
  assert.equal(result.action, 'UPDATE_CURRENT');
  assert.equal(result.steps[0].insert_after_step, 3);
});

test('uses the selected step for the short Hinglish phrase "step ke baad"', () => {
  const result = routeExplicitStepEdit(
    { action: 'NEW_PROJECT', steps: [step('Add a continuity check')] },
    'step ke baad ek testing step add karo',
    'Main Assembly',
    5,
  );
  assert.equal(result.action, 'UPDATE_CURRENT');
  assert.equal(result.steps[0].insert_after_step, 5);
});

test('keeps a new step append-only when no insertion point was requested', () => {
  const result = routeExplicitStepEdit(
    { action: 'NEW_PROJECT', steps: [step('Add a functional test')] },
    'add a new testing step',
    'Main Assembly',
    2,
  );
  assert.equal(result.action, 'UPDATE_CURRENT');
  assert.equal(result.steps[0].insert_after_step, undefined);
});

test('recognizes canvas mutations and leaves a fresh-project request explicit', () => {
  assert.equal(isCanvasMutationRequest('iss step ke baad ek testing step add karna'), true);
  assert.equal(isCanvasMutationRequest('Connect the new sensor to the controller'), true);
  assert.equal(isCanvasMutationRequest('Generate firmware code for this robot'), true);
  assert.equal(isCanvasMutationRequest('Start a new project from scratch: line follower robot'), true);
  assert.equal(isCanvasMutationRequest('Explain how a motor driver works'), false);
});

test('keeps a firmware edit on the current project even if the model suggests a reset', () => {
  const result = routeExplicitStepEdit(
    { action: 'NEW_PROJECT', steps: [step('Add firmware')] },
    'Generate firmware code for this robot',
    'Main Assembly',
    3,
  );
  assert.equal(result.action, 'UPDATE_CURRENT');
  assert.equal(result.target_tab, 'Main Assembly');
});

test('does not replace an existing project for an explicit fresh-project request', () => {
  const original = { action: 'NEW_PROJECT', steps: [step('Place controller')] };
  assert.deepEqual(
    routeExplicitStepEdit(original, 'Start a new project from scratch', 'Main Assembly', 2),
    original,
  );
});

test('routes a correction of the selected step to that step in the active tab', () => {
  const result = routeExplicitStepEdit(
    { action: 'NEW_PROJECT', target_tab: 'Main Assembly', steps: [step('corrected test')] },
    'Replace the corrected instructions in the currently selected step 3.',
    'Motor Control Electronics',
    2,
  );
  assert.equal(result.action, 'UPDATE_CURRENT');
  assert.equal(result.target_tab, 'Motor Control Electronics');
  assert.equal(result.steps[0].replace_step, 3);
});

test('adds meter-safety and topology-specific criteria to continuity-test prompts', () => {
  const prompt = buildHardwareStudioSystemPrompt({
    surface: 'circuit',
    userRequest: 'Add an unpowered continuity test to check for a short circuit.',
    currentStep: 2,
    totalSteps: 9,
  });

  assert.match(prompt, /disconnect the battery and all other sources first/i);
  assert.match(prompt, /Never measure resistance across a battery pack/i);
  assert.match(prompt, /Never use a universal resistance threshold/i);
  assert.match(prompt, /derive pass\/fail from the exact schematic\/netlist/i);
});

test('rejects invented resistance limits in continuity-test payloads', () => {
  const result = validateAgentPlan({ steps: [{
    instruction: 'Measure the supply rails for a short.',
    detail: 'Measure resistance between Vs and GND with the board assembled.',
    verify: 'Pass when the reading is typically > 100 Ohms and fail below 10 Ohms.',
  }] });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /generic numeric resistance threshold/i);
  assert.match(result.errors.join(' '), /rail-to-ground resistance test/i);
});

test('rejects resistance measurements across battery terminals', () => {
  const result = validateAgentPlan({ steps: [{
    instruction: 'Measure resistance from battery_pack:BAT+ to battery_pack:BAT-.',
    detail: 'Use the multimeter ohms mode across the battery terminals.',
    verify: 'A high value passes.',
  }] });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /across a battery or its terminals/i);
});

test('allows a topology-based inspection that uses the measured probe-lead baseline', () => {
  const result = validateAgentPlan({ steps: [{
    instruction: 'With the battery physically removed, check each motor lead against its mapped driver output.',
    detail: 'Use continuity mode only on the de-energized assembly; compare a direct wire path with the shorted-probe baseline.',
    verify: 'Each motor lead maps to exactly its assigned output in the netlist, and no motor lead is wired to a logic pin.',
  }] });

  assert.equal(result.ok, true, result.errors.join(' '));
});

test('does not flag an explicit warning against generic resistance limits', () => {
  const result = validateAgentPlan({ steps: [{
    instruction: 'Do not use a generic > 1 kOhm rule to declare the board short-free.',
    detail: 'Disconnect the battery; inspect the actual netlist and isolate nodes before meter checks.',
    verify: 'Pass only when the four motor-to-output mappings are correct and no motor conductor is assigned to a logic net.',
  }] });

  assert.equal(result.ok, true, result.errors.join(' '));
});

test('flags incomplete C++ code without silently rejecting the circuit plan', () => {
  const result = validateAgentPlan({ steps: [{
    instruction: 'Add the firmware',
    detail: 'Add the generated sketch to the controller.',
    verify: 'The sketch has balanced delimiters and defines the requested behavior.',
    code_language: 'cpp',
    code: 'void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);',
  }] });

  assert.equal(result.ok, true, result.errors.join(' '));
  assert.match(result.warnings.join(' '), /Code review .*delimiters or quotes do not balance/i);
});

test('reports placeholders but ignores braces inside C++ strings and comments', () => {
  const findings = reviewGeneratedCode([{
    instruction: 'Firmware',
    detail: 'Test the firmware.',
    verify: 'The expected output is visible.',
    code_language: 'cpp',
    code: 'void setup() { const char* text = "}"; /* { */ }\nvoid loop() { /* TODO: finish sensor handling */ }',
  }]);

  assert.equal(findings.some(finding => /placeholder/i.test(finding.message)), true);
  assert.equal(findings.some(finding => /delimiters or quotes do not balance/i.test(finding.message)), false);
});

test('prefers the latest stable full Flash model over legacy, preview, and lite models', () => {
  const models = [
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
    { name: 'models/gemini-3.9-flash-preview', displayName: 'Gemini 3.9 Flash Preview' },
    { name: 'models/gemini-3.8-flash-lite', displayName: 'Gemini 3.8 Flash Lite' },
    { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash' },
    { name: 'models/gemini-3.7-pro', displayName: 'Gemini 3.7 Pro' },
  ];

  assert.equal(chooseDefaultAgentModel(models)?.name, 'models/gemini-3.8-flash');
});

test('uses provider latest alias or a non-Flash fallback when that is all the key supports', () => {
  const latest = chooseDefaultAgentModel([
    { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash' },
    { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest' },
  ]);
  assert.equal(latest?.name, 'models/gemini-flash-latest');

  const fallback = chooseDefaultAgentModel([
    { name: 'models/gemini-3.7-pro', displayName: 'Gemini 3.7 Pro' },
    { name: 'models/gemini-3.8-pro-preview', displayName: 'Gemini 3.8 Pro Preview' },
    { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
  ]);
  assert.equal(fallback?.name, 'models/gemini-3.7-pro');
});

test('encodes an uploaded image as Gemini inline image content and preview URL', () => {
  const image = { id: 'img-1', name: 'board.webp', mimeType: 'image/webp', data: 'YWJj', byteSize: 3 };
  assert.deepEqual(toGeminiImagePart(image), { inline_data: { mime_type: 'image/webp', data: 'YWJj' } });
  assert.equal(imageAttachmentDataUrl(image), 'data:image/webp;base64,YWJj');
  assert.equal(isImageAttachment(image), true);
  assert.equal(isImageAttachment({ ...image, mimeType: 'text/html' }), false);
});
