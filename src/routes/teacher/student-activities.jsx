import { useMemo, useState } from 'react';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft, BookOpen, CalendarDays, Clock3, MessageSquareText,
    Search, ChevronDown, ChevronUp, UserRound, CircleAlert,
    MessageSquare,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card, Loading, ErrorState } from '../../components/ui';

const STATUSES = {
    SCHEDULED: { label: 'Scheduled', classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    PUBLISHED: { label: 'Live', classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    CLOSED: { label: 'Stopped', classes: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    ARCHIVED: { label: 'Archived', classes: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
};

function formatDate(value) {
    if (!value) return 'Not scheduled';
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [year, month, day] = raw.split('-').map(Number);
        return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
            .format(new Date(Date.UTC(year, month - 1, day)));
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    }).format(date);
}

function formatTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(date);
}

function ActivityStatus({ status }) {
    const details = STATUSES[status] ?? { label: status || 'Unknown', classes: 'bg-slate-100 text-slate-600' };
    return <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${details.classes}`}>{details.label}</span>;
}

function ChatHistory({ studentId, activityId }) {
    const historyQuery = useQuery({
        queryKey: ['teacher', 'student-activity-history', studentId, activityId],
        queryFn: () => api.getTeacherStudentActivityHistory(studentId, activityId),
        retry: false,
        staleTime: 30_000,
    });

    if (historyQuery.isPending) return <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-700"><Loading rows={3} /></div>;
    if (historyQuery.isError) {
        const status = historyQuery.error?.status ?? historyQuery.error?.statusCode;
        if (status === 404) return (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
                No chat history is available for this student and activity.
            </div>
        );
        return <ErrorState error={historyQuery.error} retry={() => void historyQuery.refetch()} />;
    }

    const turns = Array.isArray(historyQuery.data?.messages)
        ? [...historyQuery.data.messages].sort((a, b) => Number(a.turnNumber ?? 0) - Number(b.turnNumber ?? 0))
        : [];

    if (turns.length === 0) return (
        <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-700">
            <MessageSquareText className="mx-auto mb-2 text-slate-400" size={24} />
            <p className="font-medium">No chat history</p>
            <p className="mt-1 text-sm text-slate-500">The student has not submitted any prompts for this activity.</p>
        </div>
    );

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/40 sm:p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Read-only chat history</p>
                <span className="text-xs text-slate-500">{turns.length} {turns.length === 1 ? 'turn' : 'turns'}</span>
            </div>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1" aria-label="Chat transcript">
                {turns.map((turn, index) => (
                    <div key={turn.id ?? turn.clientRequestId ?? index} className="space-y-3">
                        <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-blue-50 p-3 text-sm text-slate-800 dark:bg-blue-950/60 dark:text-slate-100 sm:max-w-[82%]">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Student</p>
                            <p className="whitespace-pre-wrap break-words">{turn.prompt ?? ''}</p>
                        </div>
                        {typeof turn.response === 'string' && turn.response.length > 0 ? (
                            <div className="mr-auto max-w-[96%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:max-w-[90%]">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">AI Helper</p>
                                <p className="whitespace-pre-wrap break-words">{turn.response}</p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <CircleAlert size={14} /> {turn.status === 'PROCESSING' ? 'AI response is processing' : 'No AI response recorded'}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function TeacherStudentActivities() {
    const { studentId } = useParams({ from: '/teacher/students/$studentId/activities' });
    const searchParams = useSearch({ strict: false });
    const branch = String(searchParams?.branch ?? '');
    const year = String(searchParams?.year ?? '');
    const section = String(searchParams?.section ?? '');
    const [searchText, setSearchText] = useState('');
    const [openActivityId, setOpenActivityId] = useState(null);
    const validClass = Boolean(branch && year && section);

    // Re-fetches the teacher-authorized enrollment list, so refresh/direct navigation works.
    const studentsQuery = useQuery({
        queryKey: ['teacher', 'students-list', branch, year, section],
        queryFn: () => api.getStudentsList(branch, year, section),
        enabled: validClass,
        staleTime: 30_000,
    });

    const student = useMemo(() => {
        const data = Array.isArray(studentsQuery.data) ? studentsQuery.data
            : Array.isArray(studentsQuery.data?.students) ? studentsQuery.data.students : [];
        return data.find((record) => String(record.id) === String(studentId)) ?? null;
    }, [studentsQuery.data, studentId]);

    const activities = useMemo(() => {
        const list = Array.isArray(student?.activities) ? student.activities : [];
        const term = searchText.trim().toLowerCase();
        return list.filter((activity) => !term || [activity.title, activity.topic, activity.status]
            .some((field) => String(field ?? '').toLowerCase().includes(term)))
            .sort((a, b) => String(b.scheduledDate ?? '').localeCompare(String(a.scheduledDate ?? '')));
    }, [student, searchText]);

    return (
        <div className="mx-auto min-w-0 max-w-6xl space-y-5 pb-8">
       <Link
  to="/teacher/students"
  search={{
    branch,
    year,
    section,
  }}
  className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"
>
  <ArrowLeft size={17} />
  Back to Students
</Link>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                    <div className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><UserRound size={16} /> Student activity record</div>
                    <h1 className="break-words text-2xl font-bold tracking-tight">{student?.fullName || student?.username || 'Student activities'}</h1>
                    {student && <p className="mt-1 break-all text-sm text-slate-500">@{student.username} · {branch} / Year {year} / Section {section}</p>}
                </div>
                {student && <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"><BookOpen size={16} /> {(student.activities ?? []).length} enrolled</span>}
            </div>

            {!validClass ? (
                <Card className="p-6"><p className="font-semibold">Class information is missing</p><p className="mt-1 text-sm text-slate-500">Return to Students, choose Branch, Year and Section, and click GO before opening a student record.</p></Card>
            ) : studentsQuery.isPending ? <Loading rows={5} />
                : studentsQuery.isError ? <ErrorState error={studentsQuery.error} retry={() => void studentsQuery.refetch()} />
                    : !student ? (
                        <Card className="p-6"><p className="font-semibold">Student not found</p><p className="mt-1 text-sm text-slate-500">This student is not part of the selected class or is not available to your account.</p></Card>
                    ) : (
                        <>
                            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                                <div><h2 className="text-lg font-bold">Enrolled Activities</h2><p className="text-xs text-slate-500">Choose an activity to inspect the student's chat history.</p></div>
                                <div className="relative w-full sm:max-w-xs">
                                    <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search activities..." aria-label="Search student's activities" className="input w-full !pl-10" />
                                </div>
                            </Card>
                            {(student.activities ?? []).length === 0 ? (
                                <Card className="px-4 py-12 text-center"><BookOpen className="mx-auto mb-3 text-slate-400" size={32} /><h3 className="font-semibold">No activities</h3><p className="mt-1 text-sm text-slate-500">This student is not enrolled in any activities from your account.</p></Card>
                            ) : activities.length === 0 ? (
                                <Card className="p-8 text-center text-sm text-slate-500">No activities match your search.</Card>
                            ) : (
                                <div className="space-y-3">
                                    {activities.map((activity) => {
                                        const isOpen = openActivityId === String(activity.id);
                                        return (
                                            <Card key={activity.id} className="min-w-0 overflow-hidden p-0">
                                                <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                                                    <div className="min-w-0 flex-1 space-y-2">
                                                        <div className="flex flex-wrap items-start gap-2"><h3 className="break-words text-base font-bold">{activity.title}</h3><ActivityStatus status={activity.status} /></div>
                                                        {activity.topic && <p className="text-sm text-slate-500">{activity.topic}</p>}
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                                                            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {formatDate(activity.scheduledDate)}</span>
                                                            <span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> {activity.duration ?? '—'} min</span>
                                                        </div>
                                                        {(activity.startedAt || activity.endedAt) && (
                                                            <div className="space-y-1 text-xs text-slate-500">
                                                                {activity.startedAt && <p><span className="font-medium text-slate-700 dark:text-slate-300">Started:</span> {formatTime(activity.startedAt)}</p>}
                                                                {activity.endedAt && <p><span className="font-medium text-slate-700 dark:text-slate-300">Ended:</span> {formatTime(activity.endedAt)}</p>}
                                                            </div>
                                                        )}
                                                    </div>
                                              
<Link
  to="/teacher/students/$studentId/activities/$activityId/history"
  params={{
    studentId: String(studentId),
    activityId: String(activity.id),
  }}
  search={{
    branch,
    year,
    section,
  }}
  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
>
  <MessageSquare size={16} />
  View Chat History
</Link>

                                                </div>
                                                {isOpen && (
                                                    <div id={`history-${activity.id}`} className="border-t border-slate-200 p-4 dark:border-slate-800 sm:p-5">
                                                        <ChatHistory studentId={String(studentId)} activityId={String(activity.id)} />
                                                    </div>
                                                )}
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
        </div>
    );
}
