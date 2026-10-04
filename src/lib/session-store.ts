export interface ChatSessionSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export interface ChatSessionRegistry {
  version: 1;
  activeId: string;
  sessions: ChatSessionSummary[];
}

export const CHAT_SESSION_REGISTRY_KEY = (uid = 'local') => `hardware-studio-sessions-${uid}`;
export const LEGACY_CHAT_KEY = 'hardware-studio-chat';
export const LEGACY_WORKSPACE_KEY = 'hardware-studio-workspace';

export function chatSessionKey(sessionId: string, uid = 'local'): string {
  return `hardware-studio-chat-${uid}:${sessionId}`;
}

export function workspaceSessionKey(sessionId: string, uid = 'local'): string {
  return `hardware-studio-workspace-${uid}:${sessionId}`;
}

export function createChatSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeSessionTitle(value: string): string {
  const title = value.replace(/\s+/g, ' ').trim();
  if (!title) return 'New chat';
  return title.length > 56 ? `${title.slice(0, 53).trimEnd()}...` : title;
}

export function parseChatSessionRegistry(value: unknown): ChatSessionRegistry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<ChatSessionRegistry>;
  if (candidate.version !== 1 || !Array.isArray(candidate.sessions)) return null;

  const seen = new Set<string>();
  const sessions = candidate.sessions.flatMap(session => {
    if (!session || typeof session.id !== 'string' || !session.id || seen.has(session.id)) return [];
    if (typeof session.title !== 'string' || typeof session.updatedAt !== 'number') return [];
    seen.add(session.id);
    return [{ id: session.id, title: normalizeSessionTitle(session.title), updatedAt: session.updatedAt }];
  });

  if (!sessions.length) return null;
  const activeId = sessions.some(session => session.id === candidate.activeId)
    ? candidate.activeId as string
    : sessions[0].id;
  return { version: 1, activeId, sessions };
}
