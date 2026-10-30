
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Send, Square } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import { useAuth } from '../../features/auth/store';
import { Transcript } from '../../features/chat/transcript';
import { remaining, mmss } from '../../lib/utils';
import { Badge, Button, ErrorState, Loading, Spinner } from '../../components/ui';

function requestUuid() {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random generation unavailable. Use HTTPS or localhost.');
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function turnToMessages(turn) {
  const id = String(turn.id ?? turn.clientRequestId);
  const result = [{
    id: `${id}-prompt`,
    role: 'user',
    content: turn.prompt ?? '',
    createdAt: turn.createdAt ?? null,
  }];

  if (typeof turn.response === 'string' && turn.response.length > 0) {
    result.push({
      id: `${id}-response`,
      role: 'assistant',
      content: turn.response,
      createdAt: turn.completedAt ?? turn.createdAt ?? null,
    });
  }
  return result;
}

function mergeTurn(existing, incoming) {
  const id = String(incoming.id ?? '');
  const turns = Array.isArray(existing) ? existing : [];
  if (!id) return turns;
  const index = turns.findIndex((turn) => String(turn.id) === id);
  if (index === -1) return [...turns, incoming];
  return turns.map((turn, i) => i === index ? incoming : turn);
}

export function StudentChat() {
  const { activityId } = useParams({ from: '/student/activities/$activityId' });
  const userId = useAuth((state) => state.user?.id);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [draftRequest, setDraftRequest] = useState(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const shouldFollowRef = useRef(true);

  const activityQuery = useQuery({
    queryKey: keys.activity(activityId),
    queryFn: () => api.getActivity(activityId),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  // Backend guarantees one session per student + activity.
  const sessionKey = ['chat-session-entry', String(userId), String(activityId)];
  const sessionQuery = useQuery({
    queryKey: sessionKey,
    queryFn: () => api.enterActivity(activityId),
    enabled: Boolean(userId && activityId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const activity = activityQuery.data;
  const session = sessionQuery.data;
  const sessionId = session?.id == null ? null : String(session.id);
  const historyKey = ['chat-history', String(userId), sessionId];

  const historyQuery = useQuery({
    queryKey: historyKey,
    queryFn: () => api.getChatHistory(sessionId),
    enabled: Boolean(sessionId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const status = query.state.data?.session?.status;
      return ['COMPLETED', 'EXPIRED', 'TERMINATED'].includes(status) ? false : 5000;
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const effectiveSession = historyQuery.data?.session ?? session;
  const secs = remaining(activity?.startedAt, activity?.duration ?? 30, now);
  const sessionEnded = ['COMPLETED', 'EXPIRED', 'TERMINATED'].includes(effectiveSession?.status);
  const activityEnded = ['CLOSED', 'ARCHIVED'].includes(activity?.status);
  const timedOut = activity?.status === 'PUBLISHED' && Boolean(activity?.startedAt) && secs === 0;
  const canChat = activity?.status === 'PUBLISHED' && effectiveSession?.status === 'ACTIVE' && !timedOut;

  const send = useMutation({
    mutationFn: ({ prompt, clientRequestId }) =>
      api.sendChatPrompt(sessionId, prompt, clientRequestId),
    onSuccess: (turn) => {
      queryClient.setQueryData(historyKey, (old) => old ? {
        ...old,
        messages: mergeTurn(old.messages, turn),
      } : old);
      setDraftRequest(null);
      setText('');
      void queryClient.invalidateQueries({ queryKey: historyKey });
      void queryClient.invalidateQueries({ queryKey: keys.activity(activityId) });
    },
    onError: (error) => {
      toast.error(error.message || 'Unable to send message. Retry with the same prompt.');
      // Keep text and clientRequestId for an idempotent retry.
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
    onSettled: () => {
      sendingRef.current = false;
      setSending(false);
    },
  });

  const turns = Array.isArray(historyQuery.data?.messages) ? historyQuery.data.messages : [];
  const messages = useMemo(
    () => [...turns]
      .sort((a, b) => (a.turnNumber ?? 0) - (b.turnNumber ?? 0))
      .flatMap(turnToMessages),
    [turns],
  );

  // Follow new messages only when user is already near the bottom.
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    shouldFollowRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  useEffect(() => {
    if (shouldFollowRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  function submit() {
    if (sendingRef.current || sending || !canChat || !sessionId) return;
    const prompt = text.trim();
    if (!prompt) return;
    try {
      const clientRequestId = draftRequest?.prompt === prompt
        ? draftRequest.clientRequestId
        : requestUuid();
      const request = { prompt, clientRequestId };
      setDraftRequest(request);
      sendingRef.current = true;
      setSending(true);
      send.mutate(request);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate request ID');
    }
  }

  if (activityQuery.isPending || sessionQuery.isPending || historyQuery.isPending) return <Loading rows={8} />;
  if (activityQuery.isError) return <ErrorState error={activityQuery.error} retry={() => void activityQuery.refetch()} />;
  if (sessionQuery.isError) return <ErrorState error={sessionQuery.error} retry={() => void sessionQuery.refetch()} />;
  if (historyQuery.isError) return <ErrorState error={historyQuery.error} retry={() => void historyQuery.refetch()} />;

  return (
    <div className="flex h-[calc(100vh-170px)] min-h-[540px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:h-[calc(100vh-90px)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link to="/student" aria-label="Back to activities" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft size={19} />
          </Link>
          <div>
            <h1 className="font-bold">{activity?.title ?? 'Activity'}</h1>
            <div className="muted">{activity?.topic ?? ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 font-mono text-sm font-bold dark:bg-slate-800">
            <Clock size={15} /> {activity?.startedAt ? mmss(secs) : '--:--'}
          </span>
          <Badge status={sessionEnded || activityEnded || timedOut ? 'ENDED' : activity?.status ?? 'UNKNOWN'} />
        </div>
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Transcript messages={messages} typing={sending} emptyText="Ask a question to start exploring this topic." />
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        {!canChat ? (
          <div role="status" className="rounded-xl bg-amber-50 p-4 text-center font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {sessionEnded || activityEnded || timedOut ? 'Session ended · Chat history is read-only.' : 'This activity is not currently available for chatting.'}
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <textarea
              aria-label="Your message"
              className="input max-h-36 min-h-[48px] flex-1 resize-none"
              rows={2}
              placeholder="Ask anything about this topic…"
              value={text}
              disabled={sending}
              onChange={(event) => {
                setText(event.target.value);
                if (draftRequest && event.target.value.trim() !== draftRequest.prompt) setDraftRequest(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <Button aria-label="Send message" className="!h-12" disabled={!text.trim() || sending} onClick={submit}>
              {sending ? <Spinner /> : <Send size={18} />}
            </Button>
          </div>
        )}
        <p className="mt-2 text-center text-xs text-slate-400">AI can make mistakes. Check important information with your teacher.</p>
      </div>
    </div>
  );
}
