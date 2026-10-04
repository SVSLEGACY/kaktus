import type { AgentPlan } from './protocol';

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
  const explicitStep = /\bafter\b(?:\s+\w+){0,5}\s+\bstep\s*#?(\d+)\b/i.exec(request);
  const explicitReplacement = /\b(?:replace|revise|correct|rewrite|edit)\b.{0,60}\bstep\s*#?(\d+)\b/i.exec(request);
  const replacesCurrentStep = /\b(?:replace|revise|correct|rewrite|edit)\b.{0,60}\b(?:current|selected|this)\s+step\b/i.test(request);
  if (explicitReplacement || replacesCurrentStep) {
    const stepNumber = explicitReplacement ? Number(explicitReplacement[1]) : visibleStepNumber;
    return {
      ...tutorial,
      action: 'UPDATE_CURRENT',
      target_tab: activeTabName || tutorial.target_tab,
      steps: tutorial.steps.map(step => ({ ...step, replace_step: stepNumber })),
    };
  }

  const requestsInsertion = Boolean(explicitStep)
    || /\bafter\b.{0,48}\bstep\b/i.test(request)
    || /\b(?:iss|is|yeh|this)\s+step\s+ke\s+baad\b/i.test(request)
    || /\bstep\s+ke\s+baad\b/i.test(request);
  if (!requestsInsertion) return tutorial;

  const anchor = explicitStep ? Number(explicitStep[1]) : visibleStepNumber;
  return {
    ...tutorial,
    action: 'UPDATE_CURRENT',
    target_tab: activeTabName || tutorial.target_tab,
    steps: tutorial.steps.map(step => ({ ...step, insert_after_step: anchor })),
  };
}
