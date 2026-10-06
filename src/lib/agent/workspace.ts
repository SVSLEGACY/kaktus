import type { AgentPlan } from './protocol';

const PROJECT_RESET_REQUEST = /\b(?:start|create|make|begin|open)\s+(?:a\s+)?new\s+project\b|\bnew\s+project\s+from\s+scratch\b|\bstart\s+over\b|\breset\s+(?:the\s+)?(?:current\s+)?project\b|\bfrom\s+scratch\b|\b(?:naya|nayi)\s+project\s+(?:shuru|start|banao)\b/i;
const EXPLICIT_TAB_REQUEST = /\b(?:new|separate|own)\s+(?:workspace\s+)?(?:tab|module|subsystem|phase)\b|\b(?:naya|alag)\s+(?:tab|module|subsystem)\b/i;
const EDIT_VERB = /\b(?:add|insert|include|remove|delete|edit|update|modify|change|fix|correct|replace|move|connect|wire|attach|extend|revise|append|adjust|jod(?:o|na)?|lagao|lagana|hatao|hatana|badlo|badalna|sudhar(?:o|na)?|theek|sahi|जोड़|लगाओ|हटाओ|बदलो|सुधार|ठीक|जाँच)\b/i;
const EDIT_TARGET = /\b(?:step|test|testing|verification|validation|wire|wiring|component|part|pin|circuit|connection|firmware|code|sketch|sensor|motor|module|board|tab|diagram|design|led|resistors?|capacitors?|diodes?|transistors?|mosfets?|servos?|batter(?:y|ies)|drivers?|switch(?:es)?|relays?|breadboards?|arduino|esp32|l298n|controller|gpio)\b|स्टेप|टेस्ट|वायर|कंपोनेंट|सर्किट/i;
const CODE_REQUEST = /\b(?:write|generate|create|update|change|fix|rewrite|implement|program)\b.{0,80}\b(?:code|firmware|sketch|program)\b/i;

export function isCanvasMutationRequest(request: string): boolean {
  if (PROJECT_RESET_REQUEST.test(request)) return true;
  return /\b(?:build|make|design|wire|create|construct|assemble|implement|prototype|draw|diagram)\b/i.test(request)
    || CODE_REQUEST.test(request)
    || (EDIT_VERB.test(request) && EDIT_TARGET.test(request));
}

export function insertStepsAfter<T extends { insert_after_step?: number; replace_step?: number }>(
  existingSteps: T[],
  incomingSteps: T[],
): { steps: T[]; firstInsertedIndex: number } {
  if (incomingSteps.length === 0) {
    return { steps: existingSteps, firstInsertedIndex: existingSteps.length };
  }

  const insertions = new Map<number, T[]>();
  const replacements = new Map<number, T>();
  for (const step of incomingSteps) {
    if (Number.isInteger(step.replace_step)) {
      const oneBasedStep = step.replace_step as number;
      if (oneBasedStep >= 1 && oneBasedStep <= existingSteps.length) {
        const replacement = { ...step };
        delete replacement.replace_step;
        replacements.set(oneBasedStep - 1, replacement as T);
      }
      continue;
    }

    const requestedBoundary = step.insert_after_step;
    const boundary = Number.isInteger(requestedBoundary)
      ? Math.max(0, Math.min(requestedBoundary as number, existingSteps.length))
      : existingSteps.length;
    const group = insertions.get(boundary) || [];
    group.push(step);
    insertions.set(boundary, group);
  }

  const merged: T[] = [];
  let firstInsertedIndex = replacements.size
    ? Math.min(...replacements.keys())
    : existingSteps.length;

  for (let boundary = 0; boundary <= existingSteps.length; boundary += 1) {
    const group = insertions.get(boundary);
    if (group?.length) {
      firstInsertedIndex = Math.min(firstInsertedIndex, merged.length);
      merged.push(...group);
    }
    if (boundary < existingSteps.length) {
      merged.push(replacements.get(boundary) || existingSteps[boundary]);
    }
  }

  return { steps: merged, firstInsertedIndex };
}

export function routePlanPhase(
  tutorial: AgentPlan,
  phaseName: string,
  existingTabNames: string[],
): AgentPlan {
  const normalizedName = phaseName.trim();
  if (!normalizedName) return tutorial;
  const exists = existingTabNames.some(name => name.trim().toLowerCase() === normalizedName.toLowerCase());
  return {
    ...tutorial,
    action: exists ? 'UPDATE_CURRENT' : 'NEW_TAB',
    target_tab: normalizedName,
  };
}

export function routeExplicitStepEdit(
  tutorial: AgentPlan,
  request: string,
  activeTabName: string,
  visibleStepNumber: number,
): AgentPlan {
  if (PROJECT_RESET_REQUEST.test(request)) return tutorial;

  const explicitStep = /\bafter\b(?:\s+\w+){0,5}\s+\bstep\s*#?(\d+)\b/i.exec(request)
    || /\bstep\s*#?(\d+)\s+(?:ke\s+baad|ke\s+bad|after)\b/i.exec(request);
  const explicitReplacement = /\b(?:replace|revise|correct|rewrite|edit|fix|update)\b.{0,60}\bstep\s*#?(\d+)\b/i.exec(request)
    || /\bstep\s*#?(\d+)\s+(?:ko\s+)?(?:replace|revise|correct|rewrite|edit|fix|update|sahi|theek|sudhar(?:o|na)?)\b/i.exec(request);
  const replacesCurrentStep = /\b(?:replace|revise|correct|rewrite|edit|fix|update)\b.{0,60}\b(?:current|selected|this)\s+step\b/i.test(request)
    || /\b(?:current|selected|this|iss|is|yeh)\s+step\s+(?:ko\s+)?(?:sahi|theek|fix|correct|edit|revise|sudhar(?:o|na)?)\b/i.test(request);
  if (explicitReplacement || replacesCurrentStep) {
    const stepNumber = explicitReplacement ? Number(explicitReplacement[1]) : visibleStepNumber;
    return {
      ...tutorial,
      action: 'UPDATE_CURRENT',
      target_tab: activeTabName || tutorial.target_tab,
      steps: tutorial.steps.map(step => ({ ...step, replace_step: stepNumber })),
    };
  }

  const afterCurrentStep = /\bafter\b.{0,48}\b(?:this|current|selected|active)\s+step\b/i.test(request)
    || /\b(?:iss|is|yeh|this|current|selected)\s+step\s+ke\s+baad\b/i.test(request)
    || /\b(?:is|us)ke\s+baad\b|\bstep\s+ke\s+baad\b/i.test(request)
    || /(?:इस|इसी)\s+(?:स्टेप|चरण)\s+के\s+बाद/u.test(request);
  const asksToAddStep = /\b(?:add|insert|include|create)\b.{0,64}\b(?:(?:a|an|one|new|test|testing|verification|validation|assembly|build)\s+){0,3}step\b/i.test(request)
    || /\b(?:test(?:ing)?|verification|validation)\s+step\b.{0,48}\b(?:add|insert|include|create|kar(?:o|na)?)\b/i.test(request)
    || /\bstep\b.{0,40}\b(?:add|insert|include|jod(?:o|na)?|lagao|kar(?:o|na)?)\b/i.test(request)
    || /(?:स्टेप|चरण).{0,30}(?:जोड़|डाल|बना)/u.test(request);
  const requestsInsertion = Boolean(explicitStep) || afterCurrentStep || asksToAddStep;

  if (requestsInsertion) {
    const explicitAnchor = explicitStep ? Number(explicitStep[1]) : undefined;
    const anchor = explicitAnchor ?? (afterCurrentStep ? visibleStepNumber : undefined);
    return {
      ...tutorial,
      action: 'UPDATE_CURRENT',
      target_tab: activeTabName || tutorial.target_tab,
      steps: tutorial.steps.map(step => ({
        ...step,
        insert_after_step: anchor ?? step.insert_after_step,
      })),
    };
  }

  if (EXPLICIT_TAB_REQUEST.test(request)) {
    if (tutorial.action === 'NEW_PROJECT') {
      return {
        ...tutorial,
        action: 'NEW_TAB',
        target_tab: tutorial.target_tab || tutorial.project_name || activeTabName,
      };
    }
    return tutorial;
  }

  if (CODE_REQUEST.test(request) || (EDIT_VERB.test(request) && EDIT_TARGET.test(request))) {
    return {
      ...tutorial,
      action: 'UPDATE_CURRENT',
      target_tab: activeTabName || tutorial.target_tab,
    };
  }

  return tutorial;
}
