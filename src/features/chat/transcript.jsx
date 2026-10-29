import { useEffect, useRef } from 'react';
import { marked } from 'marked';
import { formatTime } from '../../lib/utils';
import { Bot, UserRound } from 'lucide-react';
marked.setOptions({ gfm: true, breaks: true });
function safeMarkdown(source) { const html = marked.parse(source, { async: false }); const container = document.createElement('template'); container.innerHTML = html; container.content.querySelectorAll('script,style,iframe,object,embed,form,svg,math').forEach(el => el.remove()); container.content.querySelectorAll('*').forEach(el => { Array.from(el.attributes).forEach(a => { if (a.name.startsWith('on') || ['srcdoc', 'style'].includes(a.name) || ((a.name === 'href' || a.name === 'src') && !/^(https?:|mailto:|#)/i.test(a.value)))
    el.removeAttribute(a.name); }); if (el.tagName === 'A') {
    el.setAttribute('rel', 'noopener noreferrer');
    el.setAttribute('target', '_blank');
} }); return container.innerHTML; }

export function Transcript({
  messages = [],
  typing = false,
  emptyText = 'No messages yet. Start the conversation!'
}) {
  const safeMessages = Array.isArray(messages)
    ? messages.filter(
        (message) =>
          message &&
          typeof message === 'object'
      )
    : [];

   const end = useRef(null); 
   useEffect(() => {
  end.current?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest'
  });
}, [messages.length, typing]); return <div aria-live="polite" aria-relevant="additions" className="space-y-5 px-4 py-6 sm:px-8">{messages.length === 0 && !typing && <div className="py-20 text-center"><div className="mb-4 inline-flex rounded-2xl bg-blue-100 p-4 text-blue-600"><Bot size={30}/></div><h3 className="font-semibold">Your AI learning assistant</h3><p className="muted mt-1">{emptyText}</p></div>}{messages.map(m => <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === 'assistant' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950' : 'order-2 bg-slate-200 text-slate-600 dark:bg-slate-700'}`}>{m.role === 'assistant' ? <Bot size={17}/> : <UserRound size={17}/>}</div><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[75%] ${m.role === 'user' ? 'rounded-tr-sm bg-blue-600 text-white' : 'rounded-tl-sm bg-slate-100 dark:bg-slate-800'}`}>
<div
  className="markdown break-words"
  dangerouslySetInnerHTML={{
    __html: safeMarkdown(
      typeof m.content === 'string' ? m.content : ''
    ),
  }}
/>
    <div className={`mt-2 text-[11px] ${m.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>{m.createdAt ? formatTime(m.createdAt) : ''}</div></div></div>)}{typing && <div className="flex items-center gap-3"><div className="rounded-full bg-blue-100 p-2 text-blue-600"><Bot size={17}/></div><div className="rounded-2xl bg-slate-100 px-5 py-3 dark:bg-slate-800"><span className="sr-only">AI is typing</span><span aria-hidden="true" className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 150}ms` }}/>)}</span></div></div>}<div ref={end}/></div>; }
