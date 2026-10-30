
import { Link } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  BookOpen,
  Clock,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';

import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import { useAuth } from '../../features/auth/store';

import {
  Card,
  Empty,
  ErrorState,
  Loading,
  SectionHeading,
} from '../../components/ui';

import { remaining } from '../../lib/utils';

// Format the date returned by NestJS
function formatDate(value) {
  if (!value) return 'Not scheduled';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Invalid date'
    : date.toLocaleDateString('en-IN');
}

function StatusBadge({ status }) {
  const colors = {
    DRAFT: 'bg-gray-100 text-gray-700',
    PUBLISHED: 'bg-blue-100 text-blue-700',
    ACTIVE: 'bg-green-100 text-green-700',
    CLOSED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-purple-100 text-purple-700',
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        colors[status] || colors.DRAFT
      }`}
    >
      {status}
    </span>
  );
}

export function StudentHome() {
  const user = useAuth((state) => state.user);

  const q = useQuery({
    queryKey: keys.activities,
    queryFn: api.getActivities,
  });

  // No enrollment filtering during testing
  const activities = Array.isArray(q.data) ? q.data : [];

  return (
    <>
      <SectionHeading
        title="My Activities"
        description={`Welcome back, ${
          user?.name?.split(' ')[0] || 'Student'
        }. Explore available learning activities.`}
      />

      {q.isPending ? (
        <Loading rows={4} />
      ) : q.isError ? (
        <ErrorState
          error={q.error}
          retry={() => q.refetch()}
        />
      ) : activities.length === 0 ? (
        <Card>
          <Empty
            title="No activities available"
            description="No activities have been created yet."
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((activity) => (
            <StudentActivityCard
              key={activity.id}
              activity={activity}
            />
          ))}
        </div>
      )}
    </>
  );
}


function StudentActivityCard({ activity }) {
  const navigate = useNavigate();

  const {
    id,
    title,
    topic,
    description,
    duration,
    scheduledDate,
    status,
  } = activity;

  // Backend status is the source of truth.
  const canEnter = status === 'PUBLISHED';

  const enterMutation = useMutation({
    mutationFn: () => api.enterActivity(id),

    onSuccess: (session) => {
      if (!session?.id) {
        toast.error('Invalid chat session response');
        return;
      }

      toast.success('Chat session opened');

      void navigate({
        to: '/student/activities/$activityId',
        params: {
          activityId: String(id),
        },
        state: {
          // Optional session data for the next page.
          // The chat page must not depend only on this state.
          sessionId: String(session.id),
        },
      });
    },

    onError: (error) => {
      toast.error(
        error.message || 'Unable to enter activity'
      );
    },
  });

  return (
    <Card className="flex flex-col p-6">
      <div className="mb-5 flex items-start justify-between">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
          <BookOpen size={22} />
        </div>

        <StatusBadge status={status} />
      </div>

      <h2 className="text-lg font-bold">
        {title}
      </h2>

      <p className="muted mt-2">
        {description || 'Explore this learning activity.'}
      </p>

      <div className="mt-auto pt-6">
        <div className="mb-5 space-y-3 text-sm text-slate-500">
          <div>
            Topic: <strong>{topic}</strong>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={15} />
            {duration ?? 30} minutes
          </div>

          <div className="flex items-center gap-2">
            <CalendarDays size={15} />
            {formatDate(scheduledDate)}
          </div>
        </div>

        {canEnter ? (
          <button
            type="button"
            onClick={() => enterMutation.mutate()}
            disabled={enterMutation.isPending}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            {enterMutation.isPending ? (
              'Opening Session...'
            ) : (
              <>
                <ArrowRight size={17} />
                Enter Activity
              </>
            )}
          </button>
        ) : (
          <button
            disabled
            className="btn-outline w-full"
          >
            {status === 'SCHEDULED'
              ? 'Waiting for Teacher'
              : status === 'CLOSED'
                ? 'Activity Ended'
                : status === 'ARCHIVED'
                  ? 'Activity Archived'
                  : 'Unavailable'}
          </button>
        )}
      </div>
    </Card>
  );
}
