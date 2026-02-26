const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Try refresh
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      const refreshRes = await fetch(`${API}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        // Retry original request
        return request<T>(path, options);
      }
    }
    localStorage.clear();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || 'Request failed');
  }

  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Streaming chat
export async function streamChat(
  convId: string,
  message: string,
  onChunk: (text: string) => void,
  onDone: (stats: { inputTokens: number; outputTokens: number; cost: number }) => void,
  onError: (err: string) => void,
) {
  const token = getToken();
  const res = await fetch(`${API}/api/chat/conversations/${convId}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    onError('Failed to connect to stream');
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const data = JSON.parse(line.slice(6));
      if (data.error) { onError(data.error); return; }
      if (data.done) { onDone({ inputTokens: data.inputTokens, outputTokens: data.outputTokens, cost: data.cost }); }
      else if (data.text) { onChunk(data.text); }
    }
  }
}

export type Conversation = {
  _id: string; title: string; model: string; provider: string;
  systemPrompt: string; isPinned: boolean; isArchived: boolean;
  totalTokens: number; totalCost: number; tags: string[];
  createdAt: string; updatedAt: string;
};

export type Message = {
  _id: string; conversationId: string; role: 'user' | 'assistant' | 'system';
  content: string; model?: string; provider?: string;
  inputTokens: number; outputTokens: number; cost: number;
  isError: boolean; createdAt: string;
};
