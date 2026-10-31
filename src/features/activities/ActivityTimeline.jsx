
import {
  CirclePlay,
  CircleStop,
  Clock3,
} from 'lucide-react';

function formatIST(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function ActivityTimeline({
  startedAt,
  endedAt,
  status,
}) {
  const started = formatIST(startedAt);
  const ended = formatIST(endedAt);

  // No timeline before an activity starts.
  if (!started && !ended) {
    return null;
  }

  const isLive = status === 'PUBLISHED';
  const isClosed = ['CLOSED', 'ARCHIVED'].includes(status);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock3 size={15} className="text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Activity Timeline
          </span>
        </div>

        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-900">
          IST
        </span>
      </div>

      <div className="space-y-4">

        {started && (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CirclePlay size={17} />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Started at
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {started}
              </p>
            </div>
          </div>
        )}

        {ended && (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <CircleStop size={17} />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Ended at
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {ended}
              </p>
            </div>
          </div>
        )}

        {isLive && started && !ended && (
          <div className="flex items-center gap-2 border-t border-slate-200 pt-3 text-xs font-medium text-emerald-600 dark:border-slate-700 dark:text-emerald-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Activity in progress
          </div>
        )}

        {isClosed && started && !ended && (
          <p className="border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700">
            Activity closed. End time unavailable.
          </p>
        )}

      </div>
    </div>
  );
}
