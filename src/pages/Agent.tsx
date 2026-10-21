import { useCallback, useEffect, useRef, useState } from 'react';
import { uuid } from '@/lib/uuid';
import { useSearchParams } from 'react-router-dom';
import {
  Bot,
  Send,
  Loader2,
  Wrench,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { useReports } from '@/hooks/useReports';
import { runAgent, TOOL_REGISTRY, MAX_TOOL_CALLS } from '@/services/agent';
import type { AgentMessage, AgentToolCall } from '@/types';
import { storageMode } from '@/services/storage';

const SUGGESTIONS = [
  'Are there any road hazards near me?',
  'Help me classify a pothole report',
  'Find similar reports',
  'Is the weather likely to affect my journey?',
  'Draft a complaint about a damaged road',
  'What should I do next with my report?',
  'Who should I contact about a broken streetlight?',
];

export function Agent() {
  const { reports } = useReports();
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: AgentMessage = {
      id: uuid(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    const pendingId = uuid();
    setMessages((prev) => [...prev, userMsg, {
      id: pendingId,
      role: 'agent',
      content: '',
      pending: true,
      timestamp: new Date().toISOString(),
    }]);
    setInput('');
    setBusy(true);

    try {
      const result = await runAgent(text.trim(), reports);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: result.response,
                toolCalls: result.toolCalls,
                pending: false,
              }
            : m
        )
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: `Error: ${(e as Error).message}`, pending: false }
            : m
        )
      );
    } finally {
      setBusy(false);
    }
    },
    [busy, reports]
  );

  // Run a task passed in the URL (?task=...) exactly once, even under React StrictMode.
  useEffect(() => {
    if (autoRan.current) return;
    const task = params.get('task');
    if (!task) return;
    autoRan.current = true;
    send(task);
    const next = new URLSearchParams(params);
    next.delete('task');
    setParams(next, { replace: true });
  }, [params, setParams, send]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto h-[calc(100dvh-3.5rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot size={24} className="accent-text" /> Agent
          </h1>
          <p className="text-sm text-muted mt-1">Rule-based tool-using agent · max {MAX_TOOL_CALLS} tool calls per turn</p>
        </div>
        <span className="badge" style={{ backgroundColor: 'rgb(var(--warning-soft))', color: 'rgb(var(--warning))' }}>
          Rule-based
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto card p-4 mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-strong)))' }}>
              <Sparkles size={26} className="text-white" />
            </div>
            <h2 className="font-semibold text-sm mb-1">Ask the WAYPOINT AI Agent</h2>
            <p className="text-xs text-muted max-w-md mx-auto mb-5">
              The agent matches your request to in-browser tools that classify hazards, find nearby and similar
              reports, check weather, draft complaints, and suggest next steps.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="chip hover:border-[rgb(var(--accent))]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Tool registry */}
      <div className="mb-3 shrink-0">
        <details className="card p-3">
          <summary className="text-xs font-medium cursor-pointer flex items-center gap-2 list-none">
            <Wrench size={14} className="accent-text" /> Available tools ({TOOL_REGISTRY.length})
            <ChevronRight size={14} className="text-faint ml-auto" />
          </summary>
          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {TOOL_REGISTRY.map((t) => (
              <div key={t.name} className="text-xs p-2 rounded-lg bg-[rgb(var(--surface-2))]">
                <code className="font-mono accent-text">{t.name}</code>
                <p className="text-faint mt-0.5">{t.description}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex gap-2 shrink-0"
      >
        <input
          className="input flex-1"
          placeholder="Ask the agent anything about road hazards..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>

      <p className="text-[10px] text-faint mt-2 flex items-center gap-1.5 shrink-0">
        <ShieldCheck size={11} />
        {storageMode === 'supabase' ? 'Agent runs are logged to Supabase.' : 'Agent runs are logged locally.'}
        Consequential actions require your confirmation. This is a rule-based agent, not a live LLM.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const [showTools, setShowTools] = useState(false);
  const isUser = message.role === 'user';

  if (message.pending) {
    return (
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'rgb(var(--accent-soft))' }}>
          <Bot size={16} className="accent-text" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Running tools...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={isUser ? { backgroundColor: 'rgb(var(--surface-2))' } : { backgroundColor: 'rgb(var(--accent-soft))' }}
      >
        {isUser ? (
          <span className="text-xs font-bold text-muted">You</span>
        ) : (
          <Bot size={16} className="accent-text" />
        )}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'bg-[rgb(var(--accent))] text-white' : 'bg-[rgb(var(--surface-2))]'}`}
          style={!isUser ? { border: '1px solid rgb(var(--border))' } : undefined}
        >
          <div className="whitespace-pre-wrap text-left">{message.content}</div>
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowTools((s) => !s)}
              className="text-[11px] text-faint hover:text-muted flex items-center gap-1"
            >
              {showTools ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {message.toolCalls.length} tool call{message.toolCalls.length > 1 ? 's' : ''}
            </button>
            {showTools && (
              <div className="mt-2 space-y-2">
                {message.toolCalls.map((call, i) => (
                  <ToolCallCard key={i} call={call} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallCard({ call }: { call: AgentToolCall }) {
  const ok = !call.error;
  return (
    <div className="card p-2.5 text-left">
      <div className="flex items-center gap-2 mb-1">
        {ok ? <CheckCircle size={13} className="text-[rgb(var(--success))]" /> : <XCircle size={13} className="text-[rgb(var(--danger))]" />}
        <code className="text-xs font-mono font-medium">{call.tool}</code>
        <span className="text-[10px] text-faint ml-auto">{call.durationMs}ms</span>
      </div>
      <div className="text-[10px] text-faint font-mono">
        args: {JSON.stringify(call.args).slice(0, 120)}
      </div>
      <div className="text-[10px] text-muted font-mono mt-1 break-all">
        → {call.error ? call.error : JSON.stringify(call.result).slice(0, 200)}
      </div>
    </div>
  );
}
