// @ts-nocheck -- ported as-is from the original kaktus app
export interface AgentModelSummary {
  name: string;
  displayName?: string;
}

function versionScore(model: AgentModelSummary): number {
  const match = /gemini[-\s]+(\d+)\.(\d+)/i.exec(`${model.name} ${model.displayName || ''}`);
  return match ? Number(match[1]) * 100 + Number(match[2]) : 0;
}

function compareModels(a: AgentModelSummary, b: AgentModelSummary): number {
  const aText = `${a.name} ${a.displayName || ''}`.toLowerCase();
  const bText = `${b.name} ${b.displayName || ''}`.toLowerCase();
  const aLatest = /\blatest\b/.test(aText) ? 1 : 0;
  const bLatest = /\blatest\b/.test(bText) ? 1 : 0;
  return bLatest - aLatest || versionScore(b) - versionScore(a);
}

function preferStableModels<T extends AgentModelSummary>(models: T[]): T[] {
  const stable = models.filter(model => !/preview|experimental/i.test(`${model.name} ${model.displayName || ''}`));
  return (stable.length ? stable : models).sort(compareModels);
}

export function chooseDefaultAgentModel<T extends AgentModelSummary>(models: T[]): T | undefined {
  const usable = models.filter(model => {
    const text = `${model.name} ${model.displayName || ''}`.toLowerCase();
    return /gemini/.test(text) && !/(tts|transcri|robotics|embedding|image|nano)/.test(text);
  });
  const fullFlash = usable
    .filter(model => /flash/.test(`${model.name} ${model.displayName || ''}`.toLowerCase()))
    .filter(model => !/(lite|preview)/.test(`${model.name} ${model.displayName || ''}`.toLowerCase()))
    .sort(compareModels);
  if (fullFlash.length) return fullFlash[0];

  const anyFlash = usable
    .filter(model => /flash/.test(`${model.name} ${model.displayName || ''}`.toLowerCase()))
    .sort(compareModels);
  if (anyFlash.length) return anyFlash[0];

  return preferStableModels(usable)[0];
}
