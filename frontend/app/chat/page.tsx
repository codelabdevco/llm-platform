'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api, streamChat, Conversation, Message } from '../../lib/api';
import { useAuth } from '../../lib/store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MODELS = [
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514',  label: 'Claude Sonnet 4' },
  { provider: 'anthropic', model: 'claude-opus-4-20250514',    label: 'Claude Opus 4' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { provider: 'openai',    model: 'gpt-4o',                   label: 'GPT-4o' },
  { provider: 'openai',    model: 'gpt-4o-mini',              label: 'GPT-4o Mini' },
  { provider: 'google',    model: 'gemini-2.0-flash',         label: 'Gemini 2.0 Flash' },
  { provider: 'google',    model: 'gemini-1.5-pro',           label: 'Gemini 1.5 Pro' },
  { provider: 'ollama',    model: 'llama3.2',                 label: 'Llama 3.2 (Local)' },
];

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);

  const loadConversations = async () => {
    const data = await api.get<Conversation[]>('/chat/conversations');
    setConversations(data);
  };

  const selectConv = async (conv: Conversation) => {
    setActiveConv(conv);
    setSystemPrompt(conv.systemPrompt || '');
    const msgs = await api.get<Message[]>(`/chat/conversations/${conv._id}/messages`);
    setMessages(msgs);
  };

  const newChat = async () => {
    const conv = await api.post<Conversation>('/chat/conversations', {
      model: selectedModel.model,
      provider: selectedModel.provider,
      systemPrompt,
    });
    setConversations(prev => [conv, ...prev]);
    setActiveConv(conv);
    setMessages([]);
  };

  const deleteConv = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.delete(`/chat/conversations/${convId}`);
    setConversations(prev => prev.filter(c => c._id !== convId));
    if (activeConv?._id === convId) { setActiveConv(null); setMessages([]); }
  };

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    if (!activeConv) await newChat();
    const convId = activeConv?._id;
    if (!convId) return;

    const userMsg: Message = {
      _id: Date.now().toString(), conversationId: convId, role: 'user',
      content: input, inputTokens: 0, outputTokens: 0, cost: 0,
      isError: false, createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamingText('');

    let fullText = '';
    await streamChat(
      convId, userMsg.content,
      (chunk) => { fullText += chunk; setStreamingText(fullText); },
      (stats) => {
        const aMsg: Message = {
          _id: (Date.now() + 1).toString(), conversationId: convId, role: 'assistant',
          content: fullText, model: selectedModel.model, provider: selectedModel.provider,
          inputTokens: stats.inputTokens, outputTokens: stats.outputTokens, cost: stats.cost,
          isError: false, createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aMsg]);
        setStreamingText('');
        setStreaming(false);
        // Update conversation title in list
        loadConversations();
      },
      (err) => { setStreaming(false); setStreamingText(''); console.error(err); },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const costDisplay = (cents: number) =>
    cents < 1 ? `<$0.01` : `$${(cents / 100).toFixed(2)}`;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f1117', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? 280 : 0, minWidth: sidebarOpen ? 280 : 0,
        background: '#161b27', borderRight: '1px solid #1e2d45',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.2s',
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1e2d45' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 16, background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LLM Platform
            </span>
            {user?.role === 'admin' && (
              <a href="/admin" style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>Admin</a>
            )}
          </div>
          <button onClick={newChat} style={{
            width: '100%', padding: '10px', background: 'linear-gradient(135deg,#3b82f6,#6d28d9)',
            border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}>+ New Chat</button>
        </div>

        {/* Model Select */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2d45' }}>
          <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>MODEL</label>
          <select
            value={`${selectedModel.provider}/${selectedModel.model}`}
            onChange={e => {
              const [provider, ...rest] = e.target.value.split('/');
              const model = rest.join('/');
              setSelectedModel(MODELS.find(m => m.provider === provider && m.model === model) || MODELS[0]);
            }}
            style={{ width: '100%', background: '#1e2d45', border: '1px solid #2d3f5c', borderRadius: 6, color: '#e2e8f0', padding: '8px', fontSize: 13 }}
          >
            {MODELS.map(m => (
              <option key={m.model} value={`${m.provider}/${m.model}`}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Conversations */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {conversations.map(conv => (
            <div
              key={conv._id}
              onClick={() => selectConv(conv)}
              style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                background: activeConv?._id === conv._id ? '#1e2d45' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                  {conv.isPinned ? '📌 ' : ''}{conv.title}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {costDisplay(conv.totalCost)} · {(conv.totalTokens / 1000).toFixed(1)}k tok
                </div>
              </div>
              <button
                onClick={e => deleteConv(conv._id, e)}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: 4, borderRadius: 4 }}
              >×</button>
            </div>
          ))}
        </div>

        {/* User info */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e2d45', fontSize: 13 }}>
          <div style={{ color: '#94a3b8', marginBottom: 4 }}>{user?.name}</div>
          <div style={{ color: '#475569', fontSize: 11 }}>
            {((user?.totalTokensUsed || 0) / 1000).toFixed(1)}k tokens · {costDisplay(user?.totalCost || 0)}
          </div>
          <button onClick={logout} style={{ marginTop: 8, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', gap: 12, background: '#161b27' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>☰</button>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{activeConv?.title || 'New Chat'}</div>
          {activeConv && (
            <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>⚙</button>
          )}
        </div>

        {/* System prompt panel */}
        {showSettings && activeConv && (
          <div style={{ padding: '12px 20px', background: '#111827', borderBottom: '1px solid #1e2d45' }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>SYSTEM PROMPT</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              onBlur={() => api.patch(`/chat/conversations/${activeConv._id}`, { systemPrompt })}
              rows={3}
              style={{ width: '100%', background: '#1e2d45', border: '1px solid #2d3f5c', borderRadius: 6, color: '#e2e8f0', padding: 8, fontSize: 13, resize: 'vertical' }}
              placeholder="You are a helpful assistant..."
            />
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!activeConv && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#475569' }}>
              <div style={{ fontSize: 40 }}>💬</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#94a3b8' }}>Start a new conversation</div>
              <div style={{ fontSize: 14 }}>Select a model and click "New Chat"</div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg._id} style={{ display: 'flex', gap: 12, maxWidth: msg.role === 'user' ? '80%' : '90%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>AI</div>
              )}
              <div>
                <div style={{
                  padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#1d4ed8' : '#1e2d45',
                  fontSize: 14, lineHeight: 1.6,
                }}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  ) : msg.content}
                </div>
                {msg.role === 'assistant' && (msg.inputTokens > 0) && (
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4, paddingLeft: 4 }}>
                    {msg.inputTokens}↑ {msg.outputTokens}↓ tok · {costDisplay(msg.cost)}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {streaming && streamingText && (
            <div style={{ display: 'flex', gap: 12, maxWidth: '90%', alignSelf: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>AI</div>
              <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: '#1e2d45', fontSize: 14, lineHeight: 1.6 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                <span style={{ display: 'inline-block', width: 8, height: 14, background: '#60a5fa', marginLeft: 2, animation: 'blink 1s infinite', verticalAlign: 'middle' }} />
              </div>
            </div>
          )}

          {streaming && !streamingText && (
            <div style={{ display: 'flex', gap: 12, alignSelf: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>AI</div>
              <div style={{ padding: '12px 16px', background: '#1e2d45', borderRadius: 12, color: '#64748b', fontSize: 14 }}>Thinking...</div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e2d45', background: '#161b27' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              rows={1}
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              style={{
                flex: 1, background: '#1e2d45', border: '1px solid #2d3f5c', borderRadius: 12,
                color: '#e2e8f0', padding: '12px 16px', fontSize: 14, resize: 'none',
                outline: 'none', maxHeight: 200, lineHeight: 1.5,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              style={{
                padding: '12px 20px', background: !input.trim() || streaming ? '#1e2d45' : 'linear-gradient(135deg,#3b82f6,#6d28d9)',
                border: 'none', borderRadius: 12, color: !input.trim() || streaming ? '#475569' : 'white',
                cursor: !input.trim() || streaming ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14,
              }}
            >
              {streaming ? '⏳' : '↑ Send'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 8, textAlign: 'center' }}>
            {selectedModel.label} · ข้อมูลของคุณไม่ถูกใช้เพื่อ train AI
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
        ::-webkit-scrollbar { width: 4px } ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: #2d3f5c; border-radius: 2px }
        p { margin-bottom: 8px } pre { background: #0f1117; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0 }
        code { font-family: monospace; font-size: 13px }
        table { border-collapse: collapse; width: 100% } th,td { border: 1px solid #2d3f5c; padding: 8px; font-size: 13px }
        th { background: #1e2d45 }
      `}</style>
    </div>
  );
}
