import type { ImageAttachment } from './image-attachments';

export type AgentPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export interface AgentMessage {
  role: 'user' | 'model';
  parts: AgentPart[];
}

export function toGeminiImagePart(image: ImageAttachment): AgentPart {
  return { inline_data: { mime_type: image.mimeType, data: image.data } };
}

export interface AgentResponse {
  text: string;
  sources: Array<{ title: string; uri: string }>;
  searchQueries: string[];
  researched: boolean;
}

interface AgentRequest {
  apiKeys: string[];
  model: string;
  systemPrompt: string;
  contents: AgentMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  research?: boolean;
  abortSignal?: AbortSignal;
}

export async function requestAgent(request: AgentRequest): Promise<AgentResponse> {
  if (!request.apiKeys || request.apiKeys.length === 0) {
    throw new Error('No API keys provided.');
  }

  // Shuffle keys for load balancing
  const keys = [...request.apiKeys].sort(() => Math.random() - 0.5);
  let lastError: any = null;

  for (const key of keys) {
    try {
      const payload = { ...request, apiKey: key };
      // Remove apiKeys array from payload to avoid sending it to the server unnecessary
      delete (payload as any).apiKeys;

      const response = await fetch('/api/agent', {
        signal: request.abortSignal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        const errorMsg = data.error || 'Agent request failed.';
        
        // Track exhaustion
        if (typeof window !== 'undefined') {
          const isQuota = response.status === 429 || (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('quota'));
          if (isQuota) {
            const errsRaw = localStorage.getItem('gemini_key_errors') || '{}';
            const errs = JSON.parse(errsRaw);
            if (!errs[key]) errs[key] = {};
            
            const baseModel = request.model.replace('models/', '');
            errs[key][baseModel] = { type: 'QUOTA_EXHAUSTED', timestamp: Date.now() };
            localStorage.setItem('gemini_key_errors', JSON.stringify(errs));
          }
        }
        
        throw new Error(errorMsg);
      }
      
      // Track usage
      try {
        if (typeof window !== 'undefined') {
          const today = new Date().toISOString().split('T')[0];
          const usageRaw = localStorage.getItem('gemini_key_usage_stats') || '{}';
          const usage = JSON.parse(usageRaw);
          if (!usage[today]) usage[today] = {};
          if (!usage[today][key]) usage[today][key] = {};
          
          const baseModel = request.model.replace('models/', '');
          if (!usage[today][key][baseModel]) usage[today][key][baseModel] = 0;
          usage[today][key][baseModel] += 1;
          localStorage.setItem('gemini_key_usage_stats', JSON.stringify(usage));
        }
      } catch(e) {
        console.error("Failed to track usage", e);
      }

      // Success! Return the text
      return {
        text: data.text || '',
        sources: Array.isArray(data.sources) ? data.sources : [],
        searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
        researched: data.researched === true,
      };
    } catch (e: any) {
      console.warn(`[Smart Handler] Key ending in ${key.slice(-4)} failed for model ${request.model}:`, e.message);
      lastError = e;
      // Continue to the next key...
    }
  }

  // If all keys failed, throw the last error we got
  throw new Error(`All keys failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

export async function listAgentModels(apiKey: string): Promise<Array<{
  name: string;
  version: string;
  displayName: string;
  description: string;
}>> {
  const response = await fetch('/api/models?key=' + encodeURIComponent(apiKey));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load models.');
  return data.models || [];
}
