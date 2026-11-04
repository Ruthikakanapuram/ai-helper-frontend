
// import { useEffect, useMemo, useRef, useState } from 'react';
// import { Link, useParams } from '@tanstack/react-router';
// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// import {
//   ArrowLeft, Clock, Send, RadioTower, CircleCheck, ClockAlert, CircleStop,
//   FileText, Image as ImageIcon, Eye, Download, X, Paperclip, MessageCircle, Check,
// } from 'lucide-react';
// import { toast } from 'sonner';
// import { api } from '../../lib/api';
// import { keys } from '../../lib/query';
// import { useAuth } from '../../features/auth/store';
// import { Transcript } from '../../features/chat/transcript';
// import { remaining, mmss } from '../../lib/utils';
// import { Button, ErrorState, Loading, Spinner } from '../../components/ui';

// const FINAL_STATUSES = ['COMPLETED', 'EXPIRED', 'TERMINATED'];
// const ENDED_ACTIVITIES = ['CLOSED', 'ARCHIVED'];

// const PREVIEWABLE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp']);

// function attachmentDetails(filePath) {
//   if (!filePath || typeof filePath !== 'string') return null;
//   const extension = filePath.split('.').pop()?.toLowerCase() || '';
//   const formats = {
//     pdf: 'PDF document', doc: 'Word document', docx: 'Word document',
//     jpg: 'Image', jpeg: 'Image', png: 'Image', webp: 'Image',
//   };
//   if (!formats[extension]) return null;
//   return { extension, label: formats[extension], previewable: PREVIEWABLE_EXTENSIONS.has(extension) };
// }

// function ActivityAttachment({ activity }) {
//   const details = attachmentDetails(activity.filePath);
//   const [previewUrl, setPreviewUrl] = useState(null);
//   const [loadingAction, setLoadingAction] = useState(null);
//   const activeUrlRef = useRef(null);

//   useEffect(() => () => {
//     if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
//   }, []);

//   if (!details) return null;

//   const safeTitle = String(activity.title || 'activity')
//     .replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'activity';
//   const downloadName = `${safeTitle}.${details.extension}`;
//   const Icon = details.label === 'Image' ? ImageIcon : FileText;

//   async function fetchAttachment(action) {
//     if (loadingAction) return;
//     setLoadingAction(action);
//     try {
//       // Uses an authenticated fetch; do not expose uploads/ as static files.
//       const blob = await api.getActivityAttachment(activity.id);
//       const url = URL.createObjectURL(blob);
//       if (action === 'preview') {
//         if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
//         activeUrlRef.current = url;
//         setPreviewUrl(url);
//       } else {
//         const anchor = document.createElement('a');
//         anchor.href = url;
//         anchor.download = downloadName;
//         document.body.appendChild(anchor);
//         anchor.click();
//         anchor.remove();
//         setTimeout(() => URL.revokeObjectURL(url), 60_000);
//       }
//     } catch (error) {
//       toast.error(error?.message || 'Unable to load the attachment.');
//     } finally {
//       setLoadingAction(null);
//     }
//   }

//   function closePreview() {
//     setPreviewUrl(null);
//     if (activeUrlRef.current) {
//       URL.revokeObjectURL(activeUrlRef.current);
//       activeUrlRef.current = null;
//     }
//   }

//   return (
//     <>
//       <div className="flex min-w-0 items-center gap-1 sm:gap-1.5" aria-label="Teacher reference attachment">
//         {/* <div className="hidden items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:flex">
//           <Icon size={15} className="shrink-0" />
//           <span className="text-xs font-medium">{details.extension.toUpperCase()}</span>
//         </div> */}
//         {details.previewable && (
//           <button type="button" onClick={() => void fetchAttachment('preview')}
//             disabled={Boolean(loadingAction)} title={`View teacher's ${details.label}`}
//             aria-label={`View teacher's ${details.label}`}
//             className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-slate-800 sm:px-2.5">
//             <Eye size={16} /> <span className="hidden sm:inline">View Attachment</span>
//           </button>
//         )}
//         <button type="button" onClick={() => void fetchAttachment('download')}
//           disabled={Boolean(loadingAction)} title="Download teacher's attachment"
//           aria-label="Download teacher's attachment"
//           className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-2.5">
//           <Download size={16} /> <span className="hidden sm:inline">Download</span>
//         </button>
//       </div>
//       {previewUrl && (
//         <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Activity attachment preview">
//           <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-t-xl bg-white px-4 py-2.5 text-slate-900 dark:bg-slate-900 dark:text-white">
//             <span className="truncate text-sm font-semibold">{activity.title} · {details.label}</span>
//             <button type="button" onClick={closePreview} aria-label="Close preview" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
//           </div>
//           <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-hidden rounded-b-xl bg-white dark:bg-slate-900">
//             {details.extension === 'pdf' ? (
//               <iframe title="Activity PDF" src={previewUrl} className="h-full w-full border-0" />
//             ) : (
//               <div className="flex h-full w-full items-center justify-center overflow-auto p-3">
//                 <img src={previewUrl} alt="Teacher's reference" className="max-h-full max-w-full object-contain" />
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//     </>
//   );
// }


// function requestUuid() {
//   if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
//     throw new Error('Secure random generation unavailable. Open the app on HTTPS or localhost.');
//   }
//   const bytes = new Uint8Array(16);
//   crypto.getRandomValues(bytes);
//   bytes[6] = (bytes[6] & 15) | 64;
//   bytes[8] = (bytes[8] & 63) | 128;
//   const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
//   return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
// }

// function turnToMessages(turn) {
//   const id = String(turn.id ?? turn.clientRequestId);
//   const result = [{
//     id: `${id}-prompt`,
//     role: 'user',
//     content: turn.prompt ?? '',
//     createdAt: turn.createdAt ?? null,
//   }];
//   if (typeof turn.response === 'string' && turn.response.length > 0) {
//     result.push({
//       id: `${id}-response`,
//       role: 'assistant',
//       content: turn.response,
//       createdAt: turn.completedAt ?? turn.createdAt ?? null,
//     });
//   }
//   return result;
// }

// function mergeTurn(items, incoming) {
//   const turns = Array.isArray(items) ? items : [];
//   const id = String(incoming.id ?? '');
//   if (!id) return turns;
//   return turns.some((turn) => String(turn.id) === id)
//     ? turns.map((turn) => String(turn.id) === id ? incoming : turn)
//     : [...turns, incoming];
// }

// function SessionStatus({ status }) {
//   const config = {
//     ACTIVE: { label: 'LIVE', Icon: RadioTower, style: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
//     COMPLETED: { label: 'COMPLETED', Icon: CircleCheck, style: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
//     EXPIRED: { label: 'EXPIRED', Icon: ClockAlert, style: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
//     TERMINATED: { label: 'TERMINATED', Icon: CircleStop, style: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
//   };
//   const current = config[status] ?? { label: status ?? 'UNKNOWN', Icon: ClockAlert, style: 'bg-slate-100 text-slate-700' };
//   const Icon = current.Icon;
//   return (
//     <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${current.style}`}>
//       <Icon size={14} className={status === 'ACTIVE' ? 'animate-pulse' : ''} />
//       {current.label}
//     </span>
//   );
// }

// export function StudentChat() {
//   const { activityId } = useParams({ from: '/student/activities/$activityId' });
//   const userId = useAuth((state) => state.user?.id);
//   const queryClient = useQueryClient();
//   const [text, setText] = useState('');
//   const [useActivityFile, setUseActivityFile] = useState(false);
//   const [now, setNow] = useState(() => Date.now());
//   const [pendingPrompt, setPendingPrompt] = useState(null);
//   const [sending, setSending] = useState(false);
//   const sendingRef = useRef(false);
//   const scrollRef = useRef(null);
//   const bottomRef = useRef(null);
//   const shouldFollowRef = useRef(true);

//   const activitiesQuery = useQuery({
//     queryKey: keys.activities,
//     queryFn: api.getActivities,
//     refetchOnWindowFocus: true,
//     refetchInterval: 10000,
//   });
//   const activity = Array.isArray(activitiesQuery.data)
//     ? activitiesQuery.data.find((item) => String(item.id) === String(activityId))
//     : null;
//   const listedSession = activity?.chatSession ?? null;
//   const hasActivityFile = Boolean(attachmentDetails(activity?.filePath));

//   useEffect(() => {
//     setUseActivityFile(false);
//   }, [activityId]);
//   const sessionKey = ['chat-session-entry', String(userId), String(activityId)];
//   const sessionQuery = useQuery({
//     queryKey: sessionKey,
//     enabled: Boolean(userId && activityId && activitiesQuery.isSuccess && activity),
//     queryFn: () => {
//       if (listedSession?.id) return listedSession;
//       if (activity?.status === 'PUBLISHED') return api.enterActivity(activityId);
//       return null;
//     },
//     staleTime: 30000,
//     refetchOnWindowFocus: false,
//     refetchOnReconnect: false,
//     retry: false,
//   });
//   const session = sessionQuery.data;
//   const sessionId = session?.id == null ? null : String(session.id);
//   const historyKey = ['chat-history', String(sessionId)];
//   const historyQuery = useQuery({
//     queryKey: historyKey,
//     queryFn: () => api.getChatHistory(sessionId),
//     enabled: Boolean(sessionId),
//     refetchOnWindowFocus: true,
//     refetchInterval: (query) => (
//       sending || FINAL_STATUSES.includes(query.state.data?.session?.status) ||
//         ENDED_ACTIVITIES.includes(activity?.status) ? false : 5000
//     ),
//   });

//   useEffect(() => {
//     const timer = setInterval(() => setNow(Date.now()), 1000);
//     return () => clearInterval(timer);
//   }, []);

//   const effectiveSession = historyQuery.data?.session ?? session;
//   const sessionEnded = FINAL_STATUSES.includes(effectiveSession?.status);
//   const activityEnded = ENDED_ACTIVITIES.includes(activity?.status);
//   const canChat = activity?.status === 'PUBLISHED' && effectiveSession?.status === 'ACTIVE' && !sessionEnded && !activityEnded;
//   const secs = remaining(activity?.startedAt, activity?.duration ?? 30, now);
//   const turns = historyQuery.data?.messages;

//   const send = useMutation({
//     mutationFn: ({ prompt, clientRequestId, attachFile }) =>
//       api.sendChatPrompt(sessionId, prompt, clientRequestId, attachFile),
//     onSuccess: (turn) => {
//       queryClient.setQueryData(historyKey, (old) => old
//         ? { ...old, messages: mergeTurn(old.messages, turn) }
//         : { session: effectiveSession, messages: [turn] });
//       setPendingPrompt(null);
//       void queryClient.invalidateQueries({ queryKey: historyKey });
//     },
//     onError: (error) => {
//       setPendingPrompt((previous) => previous ? { ...previous, status: 'FAILED' } : null);
//       toast.error(error.message || 'Unable to send prompt.');
//     },
//     onSettled: () => {
//       sendingRef.current = false;
//       setSending(false);
//     },
//   });

//   const messages = useMemo(() => {
//     const savedTurns = Array.isArray(turns)
//       ? [...turns].sort((a, b) => Number(a.turnNumber ?? 0) - Number(b.turnNumber ?? 0))
//       : [];
//     const savedMessages = savedTurns.flatMap(turnToMessages);
//     if (!pendingPrompt) return savedMessages;

//     // Match by UUID if the history API includes clientRequestId.
//     // Until then, match only a NEW turn, after the turnNumber observed at submit time.
//     // This avoids duplicate user bubbles even when polling returns PROCESSING rows.
//     const persisted = savedTurns.some((turn) => {
//       if (turn.clientRequestId && String(turn.clientRequestId) === pendingPrompt.clientRequestId) {
//         return true;
//       }
//       return Number(turn.turnNumber) > pendingPrompt.lastTurnNumber && turn.prompt === pendingPrompt.prompt;
//     });
//     if (persisted) return savedMessages;

//     return [...savedMessages, {
//       id: `pending-${pendingPrompt.clientRequestId}`,
//       role: 'user',
//       content: pendingPrompt.prompt,
//       createdAt: pendingPrompt.createdAt,
//       status: pendingPrompt.status,
//     }];
//   }, [turns, pendingPrompt]);

//   function handleScroll() {
//     const element = scrollRef.current;
//     if (element) shouldFollowRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
//   }
//   useEffect(() => {
//     if (shouldFollowRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
//   }, [messages.length, sending]);

//   function submit() {
//     if (sendingRef.current || sending || !canChat || !sessionId) return;
//     const prompt = text.trim();
//     if (!prompt) return;
//     try {
//       const clientRequestId = requestUuid();
//       const savedTurns = queryClient.getQueryData(historyKey)?.messages ?? [];
//       const lastTurnNumber = Math.max(0, ...savedTurns.map((turn) => Number(turn.turnNumber) || 0));
//       sendingRef.current = true;
//       shouldFollowRef.current = true;
//       setPendingPrompt({
//         prompt,
//         clientRequestId,
//         lastTurnNumber,
//         createdAt: new Date().toISOString(),
//         status: 'PROCESSING',
//         attachFile: hasActivityFile && useActivityFile,
//       });
//       setText('');
//       setSending(true);
//             const attachFile = hasActivityFile && useActivityFile;
//       send.mutate({ prompt, clientRequestId, attachFile });
//     } catch (error) {
//       toast.error(error instanceof Error ? error.message : 'Unable to create request ID');
//     }
//   }

//   if (activitiesQuery.isPending || sessionQuery.isPending || (sessionId && historyQuery.isPending)) return <Loading rows={8} />;
//   if (activitiesQuery.isError) return <ErrorState error={activitiesQuery.error} retry={() => void activitiesQuery.refetch()} />;
//   if (!activity) return <div role="alert" className="panel p-8">Activity not found or not assigned to you.</div>;
//   if (sessionQuery.isError) return <ErrorState error={sessionQuery.error} retry={() => void sessionQuery.refetch()} />;
//   if (historyQuery.isError) return <ErrorState error={historyQuery.error} retry={() => void historyQuery.refetch()} />;

//   return (
//     <div className="flex h-[calc(100dvh-7.5rem)] min-h-[380px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-6rem)]">
//       {/* Compact header: reference actions live beside the activity title. */}
//       <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-2.5 dark:border-slate-800 sm:px-4 sm:py-3">
//         <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
//           <Link to="/student" aria-label="Back to activities"
//             className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800">
//             <ArrowLeft size={18} />
//           </Link>
//           <div className="min-w-0">
//             <h1 className="truncate text-sm font-bold text-slate-900 dark:text-white sm:text-base" title={activity.title}>{activity.title}</h1>
//             {activity.filePath ? (
//               <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">Teacher's {attachmentDetails(activity.filePath)?.label?.toLowerCase()} attached</p>
//             ) : (
//               <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{activity.topic}</p>
//             )}
//           </div>
//           {hasActivityFile && (
//             <div className="shrink-0 border-l border-slate-200 pl-1 dark:border-slate-700 sm:pl-2">
//               <ActivityAttachment activity={activity} />
//             </div>
//           )}
//         </div>
//         <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
//           <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 font-mono text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:text-sm" title="Time remaining">
//             <Clock size={14} /> {activity.startedAt ? mmss(secs) : '--:--'}
//           </span>
//           <div className="hidden sm:block">
//             <SessionStatus status={activityEnded && effectiveSession?.status === 'ACTIVE' ? 'TERMINATED' : effectiveSession?.status} />
//           </div>
//         </div>
//       </header>

//       {/* Transcript gets the remaining vertical space. */}
//       <div ref={scrollRef} onScroll={handleScroll}
//         className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white dark:bg-slate-900">
//         <div className="mx-auto w-full max-w-4xl px-2 py-3 sm:px-5 sm:py-5">
//           <Transcript messages={messages} typing={sending} emptyText="Ask a question to start exploring this topic." />
//           <div ref={bottomRef} aria-hidden="true" />
//         </div>
//       </div>

//       {/* All mode controls are inside the composer, not in a separate panel. */}
//       <div className="shrink-0 border-t border-slate-200 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-3">
//         <div className="mx-auto w-full max-w-4xl">
//           {!sessionId ? (
//             <div role="status" className="rounded-xl bg-slate-100 p-3 text-center text-sm dark:bg-slate-800">No chat history exists for this activity.</div>
//           ) : !canChat ? (
//             <div role="status" className="rounded-xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">Session ended · Chat history is read-only.</div>
//           ) : (
//             <>
//               {pendingPrompt?.status === 'FAILED' && (
//                 <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
//                   The request failed. Your prompt is preserved above; you can send it again as a new prompt.
//                 </div>
//               )}
//               <div className="rounded-2xl border border-slate-300 bg-slate-50/50 p-2 shadow-sm transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-800/50 dark:focus-within:ring-blue-950 sm:p-3">
//                 {hasActivityFile && useActivityFile && (
//                   <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-blue-50 px-2 py-1.5 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" role="status">
//                     <FileText size={14} className="shrink-0" />
//                     <span className="min-w-0 flex-1 truncate">Teacher's {attachmentDetails(activity.filePath)?.label?.toLowerCase()} included in this question</span>
//                     <button type="button" onClick={() => setUseActivityFile(false)} disabled={sending}
//                       aria-label="Remove teacher's file from question" title="Remove file" className="rounded p-1 hover:bg-blue-100 disabled:opacity-40 dark:hover:bg-blue-900"><X size={14} /></button>
//                   </div>
//                 )}
//                 <textarea
//                   aria-label="Your message"
//                   className="block max-h-32 min-h-[52px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white sm:max-h-44 sm:text-base"
//                   rows={2}
//                   placeholder={hasActivityFile && useActivityFile ? 'Ask about the teacher’s file…' : 'Ask anything about this topic…'}
//                   value={text}
//                   disabled={sending}
//                   onChange={(event) => setText(event.target.value)}
//                   onKeyDown={(event) => {
//                     if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
//                       event.preventDefault();
//                       submit();
//                     }
//                   }}
//                 />
//                 <div className="flex items-center justify-between gap-2 px-1 pt-1">
//                   <div className="flex min-w-0 flex-wrap items-center gap-1.5">
//                     {hasActivityFile ? (
//                       <>
//                         <button type="button" onClick={() => setUseActivityFile(false)} disabled={sending}
//                           aria-pressed={!useActivityFile}
//                           className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${!useActivityFile ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
//                           <MessageCircle size={14} /> General
//                         </button>
//                         <button type="button" onClick={() => setUseActivityFile(true)} disabled={sending}
//                           aria-pressed={useActivityFile}
//                           className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${useActivityFile ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
//                           <Paperclip size={14} /> <span className="hidden min-[375px]:inline">Teacher's</span> file {useActivityFile && <Check size={13} />}
//                         </button>
//                       </>
//                     ) : (
//                       <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><MessageCircle size={14} /> General questions</span>
//                     )}
//                   </div>
//                   <button type="button" aria-label="Send message" title="Send message"
//                     disabled={!text.trim() || sending}
//                     onClick={submit}
//                     className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10">
//                     {sending ? <Spinner /> : <Send size={18} />}
//                   </button>
//                 </div>
//               </div>
//             </>
//           )}
//           <p className="mt-1.5 text-center text-[10px] text-slate-400 sm:text-xs">AI can make mistakes. Check important information with your teacher.</p>
//         </div>
//       </div>
//     </div>
//   );
// }

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Clock, Send, RadioTower, CircleCheck, ClockAlert, CircleStop,
  FileText, Image as ImageIcon, Eye, Download, X, Paperclip, MessageCircle, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import { useAuth } from '../../features/auth/store';
import { Transcript } from '../../features/chat/transcript';
import { remaining, mmss } from '../../lib/utils';
import { Button, ErrorState, Loading, Spinner } from '../../components/ui';

const FINAL_STATUSES = ['COMPLETED', 'EXPIRED', 'TERMINATED'];
const ENDED_ACTIVITIES = ['CLOSED', 'ARCHIVED'];

const PREVIEWABLE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp']);

function attachmentDetails(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  const formats = {
    pdf: 'PDF document', doc: 'Word document', docx: 'Word document',
    jpg: 'Image', jpeg: 'Image', png: 'Image', webp: 'Image',
  };
  if (!formats[extension]) return null;
  return { extension, label: formats[extension], previewable: PREVIEWABLE_EXTENSIONS.has(extension) };
}

function ActivityAttachment({ activity }) {
  const details = attachmentDetails(activity.filePath);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null);
  const activeUrlRef = useRef(null);

  useEffect(() => () => {
    if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
  }, []);

  if (!details) return null;

  const safeTitle = String(activity.title || 'activity')
    .replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'activity';
  const downloadName = `${safeTitle}.${details.extension}`;
  const Icon = details.label === 'Image' ? ImageIcon : FileText;

  async function fetchAttachment(action) {
    if (loadingAction) return;
    setLoadingAction(action);
    try {
      // Uses an authenticated fetch; do not expose uploads/ as static files.
      const blob = await api.getActivityAttachment(activity.id);
      const url = URL.createObjectURL(blob);
      if (action === 'preview') {
        if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = url;
        setPreviewUrl(url);
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = downloadName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      toast.error(error?.message || 'Unable to load the attachment.');
    } finally {
      setLoadingAction(null);
    }
  }

  function closePreview() {
    setPreviewUrl(null);
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-1 sm:gap-1.5" aria-label="Teacher reference attachment">
        {/* <div className="hidden items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:flex">
          <Icon size={15} className="shrink-0" />
          <span className="text-xs font-medium">{details.extension.toUpperCase()}</span>
        </div> */}
        {details.previewable && (
          <button type="button" onClick={() => void fetchAttachment('preview')}
            disabled={Boolean(loadingAction)} title={`View teacher's ${details.label}`}
            aria-label={`View teacher's ${details.label}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-slate-800 sm:px-2.5">
            <Eye size={16} /> <span className="hidden sm:inline">View Attachment</span>
          </button>
        )}
        <button type="button" onClick={() => void fetchAttachment('download')}
          disabled={Boolean(loadingAction)} title="Download teacher's attachment"
          aria-label="Download teacher's attachment"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-2.5">
          <Download size={16} /> <span className="hidden sm:inline">Download</span>
        </button>
      </div>
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Activity attachment preview">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-t-xl bg-white px-4 py-2.5 text-slate-900 dark:bg-slate-900 dark:text-white">
            <span className="truncate text-sm font-semibold">{activity.title} · {details.label}</span>
            <button type="button" onClick={closePreview} aria-label="Close preview" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
          </div>
          <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-hidden rounded-b-xl bg-white dark:bg-slate-900">
            {details.extension === 'pdf' ? (
              <iframe title="Activity PDF" src={previewUrl} className="h-full w-full border-0" />
            ) : (
              <div className="flex h-full w-full items-center justify-center overflow-auto p-3">
                <img src={previewUrl} alt="Teacher's reference" className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


function requestUuid() {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random generation unavailable. Open the app on HTTPS or localhost.');
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
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

function mergeTurn(items, incoming) {
  const turns = Array.isArray(items) ? items : [];
  const id = String(incoming.id ?? '');
  if (!id) return turns;
  return turns.some((turn) => String(turn.id) === id)
    ? turns.map((turn) => String(turn.id) === id ? incoming : turn)
    : [...turns, incoming];
}

function SessionStatus({ status }) {
  const config = {
    ACTIVE: { label: 'LIVE', Icon: RadioTower, style: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
    COMPLETED: { label: 'COMPLETED', Icon: CircleCheck, style: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    EXPIRED: { label: 'EXPIRED', Icon: ClockAlert, style: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    TERMINATED: { label: 'TERMINATED', Icon: CircleStop, style: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  };
  const current = config[status] ?? { label: status ?? 'UNKNOWN', Icon: ClockAlert, style: 'bg-slate-100 text-slate-700' };
  const Icon = current.Icon;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${current.style}`}>
      <Icon size={14} className={status === 'ACTIVE' ? 'animate-pulse' : ''} />
      {current.label}
    </span>
  );
}

export function StudentChat() {
  const { activityId } = useParams({ from: '/student/activities/$activityId' });
  const userId = useAuth((state) => state.user?.id);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [useActivityFile, setUseActivityFile] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const shouldFollowRef = useRef(true);

  const activitiesQuery = useQuery({
    queryKey: keys.activities,
    queryFn: api.getActivities,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });
  const activity = Array.isArray(activitiesQuery.data)
    ? activitiesQuery.data.find((item) => String(item.id) === String(activityId))
    : null;
  const listedSession = activity?.chatSession ?? null;
  const hasActivityFile = Boolean(attachmentDetails(activity?.filePath));

  useEffect(() => {
    setUseActivityFile(false);
  }, [activityId]);
  const sessionKey = ['chat-session-entry', String(userId), String(activityId)];
  const sessionQuery = useQuery({
    queryKey: sessionKey,
    enabled: Boolean(userId && activityId && activitiesQuery.isSuccess && activity),
    queryFn: () => {
      if (listedSession?.id) return listedSession;
      if (activity?.status === 'PUBLISHED') return api.enterActivity(activityId);
      return null;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const session = sessionQuery.data;
  const sessionId = session?.id == null ? null : String(session.id);
  const historyKey = ['chat-history', String(sessionId)];
  const historyQuery = useQuery({
    queryKey: historyKey,
    queryFn: () => api.getChatHistory(sessionId),
    enabled: Boolean(sessionId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (
      sending || FINAL_STATUSES.includes(query.state.data?.session?.status) ||
        ENDED_ACTIVITIES.includes(activity?.status) ? false : 5000
    ),
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const effectiveSession = historyQuery.data?.session ?? session;
  const sessionEnded = FINAL_STATUSES.includes(effectiveSession?.status);
  const activityEnded = ENDED_ACTIVITIES.includes(activity?.status);
  const canChat = activity?.status === 'PUBLISHED' && effectiveSession?.status === 'ACTIVE' && !sessionEnded && !activityEnded;
  const secs = remaining(activity?.startedAt, activity?.duration ?? 30, now);
  const turns = historyQuery.data?.messages;

  const send = useMutation({
    mutationFn: ({ prompt, clientRequestId, attachFile }) =>
      api.sendChatPrompt(sessionId, prompt, clientRequestId, attachFile),
    onSuccess: (turn) => {
      queryClient.setQueryData(historyKey, (old) => old
        ? { ...old, messages: mergeTurn(old.messages, turn) }
        : { session: effectiveSession, messages: [turn] });
      setPendingPrompt(null);
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
    onError: (error) => {
      setPendingPrompt((previous) => previous ? { ...previous, status: 'FAILED' } : null);
      toast.error(error.message || 'Unable to send prompt.');
    },
    onSettled: () => {
      sendingRef.current = false;
      setSending(false);
    },
  });

  const messages = useMemo(() => {
    const savedTurns = Array.isArray(turns)
      ? [...turns].sort((a, b) => Number(a.turnNumber ?? 0) - Number(b.turnNumber ?? 0))
      : [];
    const savedMessages = savedTurns.flatMap(turnToMessages);
    if (!pendingPrompt) return savedMessages;

    // Match by UUID if the history API includes clientRequestId.
    // Until then, match only a NEW turn, after the turnNumber observed at submit time.
    // This avoids duplicate user bubbles even when polling returns PROCESSING rows.
    const persisted = savedTurns.some((turn) => {
      if (turn.clientRequestId && String(turn.clientRequestId) === pendingPrompt.clientRequestId) {
        return true;
      }
      return Number(turn.turnNumber) > pendingPrompt.lastTurnNumber && turn.prompt === pendingPrompt.prompt;
    });
    if (persisted) return savedMessages;

    return [...savedMessages, {
      id: `pending-${pendingPrompt.clientRequestId}`,
      role: 'user',
      content: pendingPrompt.prompt,
      createdAt: pendingPrompt.createdAt,
      status: pendingPrompt.status,
    }];
  }, [turns, pendingPrompt]);

  function handleScroll() {
    const element = scrollRef.current;
    if (element) shouldFollowRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }
  useEffect(() => {
    if (shouldFollowRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  function submit() {
    if (sendingRef.current || sending || !canChat || !sessionId) return;
    const prompt = text.trim();
    if (!prompt) return;
    try {
      const clientRequestId = requestUuid();
      const savedTurns = queryClient.getQueryData(historyKey)?.messages ?? [];
      const lastTurnNumber = Math.max(0, ...savedTurns.map((turn) => Number(turn.turnNumber) || 0));
      sendingRef.current = true;
      shouldFollowRef.current = true;
      setPendingPrompt({
        prompt,
        clientRequestId,
        lastTurnNumber,
        createdAt: new Date().toISOString(),
        status: 'PROCESSING',
        attachFile: hasActivityFile && useActivityFile,
      });
      setText('');
      setSending(true);
            const attachFile = hasActivityFile && useActivityFile;
      send.mutate({ prompt, clientRequestId, attachFile });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create request ID');
    }
  }

  if (activitiesQuery.isPending || sessionQuery.isPending || (sessionId && historyQuery.isPending)) return <Loading rows={8} />;
  if (activitiesQuery.isError) return <ErrorState error={activitiesQuery.error} retry={() => void activitiesQuery.refetch()} />;
  if (!activity) return <div role="alert" className="panel p-8">Activity not found or not assigned to you.</div>;
  if (sessionQuery.isError) return <ErrorState error={sessionQuery.error} retry={() => void sessionQuery.refetch()} />;
  if (historyQuery.isError) return <ErrorState error={historyQuery.error} retry={() => void historyQuery.refetch()} />;

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[380px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-6rem)]">
      {/* Compact header: reference actions live beside the activity title. */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-2.5 dark:border-slate-800 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link to="/student" aria-label="Back to activities"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-slate-900 dark:text-white sm:text-base" title={activity.title}>{activity.title}</h1>
            {activity.filePath ? (
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">(1) Attachment available</p>
            ) : (
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{activity.topic}</p>
            )}
          </div>
          {hasActivityFile && (
            <div className="shrink-0 border-l border-slate-200 pl-1 dark:border-slate-700 sm:pl-2">
              <ActivityAttachment activity={activity} />
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 font-mono text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:text-sm" title="Time remaining">
            <Clock size={14} /> {activity.startedAt ? mmss(secs) : '--:--'}
          </span>
          <div className="hidden sm:block">
            <SessionStatus status={activityEnded && effectiveSession?.status === 'ACTIVE' ? 'TERMINATED' : effectiveSession?.status} />
          </div>
        </div>
      </header>

      {/* Transcript gets the remaining vertical space. */}
      <div ref={scrollRef} onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white dark:bg-slate-900">
        <div className="mx-auto w-full max-w-4xl px-2 py-3 sm:px-5 sm:py-5">
          <Transcript messages={messages} typing={sending} emptyText="Ask a question to start exploring this topic." />
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </div>

      {/* All mode controls are inside the composer, not in a separate panel. */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-3">
        <div className="mx-auto w-full max-w-4xl">
          {!sessionId ? (
            <div role="status" className="rounded-xl bg-slate-100 p-3 text-center text-sm dark:bg-slate-800">No chat history exists for this activity.</div>
          ) : !canChat ? (
            <div role="status" className="rounded-xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">Session ended · Chat history is read-only.</div>
          ) : (
            <>
              {pendingPrompt?.status === 'FAILED' && (
                <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                  The request failed. Your prompt is preserved above; you can send it again as a new prompt.
                </div>
              )}
              <div className="rounded-2xl border border-slate-300 bg-slate-50/50 p-2 shadow-sm transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-800/50 dark:focus-within:ring-blue-950 sm:p-3">
                {hasActivityFile && useActivityFile && (
                  <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-blue-50 px-2 py-1.5 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" role="status">
                    <FileText size={14} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">Attachment included in this question</span>
                    <button type="button" onClick={() => setUseActivityFile(false)} disabled={sending}
                      aria-label="Remove teacher's file from question" title="Remove file" className="rounded p-1 hover:bg-blue-100 disabled:opacity-40 dark:hover:bg-blue-900"><X size={14} /></button>
                  </div>
                )}
                <textarea
                  aria-label="Your message"
                  className="block max-h-32 min-h-[52px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white sm:max-h-44 sm:text-base"
                  rows={2}
                  placeholder={hasActivityFile && useActivityFile ? 'Ask about the attachment…' : 'Ask anything about this topic…'}
                  value={text}
                  disabled={sending}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2 px-1 pt-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {hasActivityFile ? (
                      <>
                        <button type="button" onClick={() => setUseActivityFile(false)} disabled={sending}
                          aria-pressed={!useActivityFile}
                          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${!useActivityFile ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                          <MessageCircle size={14} /> General
                        </button>
                        <button type="button" onClick={() => setUseActivityFile(true)} disabled={sending}
                          aria-pressed={useActivityFile}
                          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${useActivityFile ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                          <Paperclip size={14} /> Use Attachment {useActivityFile && <Check size={13} />}
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><MessageCircle size={14} /> General questions</span>
                    )}
                  </div>
                  <button type="button" aria-label="Send message" title="Send message"
                    disabled={!text.trim() || sending}
                    onClick={submit}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10">
                    {sending ? <Spinner /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </>
          )}
          <p className="mt-1.5 text-center text-[10px] text-slate-400 sm:text-xs">AI can make mistakes. Check important information with your teacher.</p>
        </div>
      </div>
    </div>
  );
}
