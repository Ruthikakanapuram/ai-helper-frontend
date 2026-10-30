
import { useQuery } from '@tanstack/react-query';

import { api } from '../../lib/api';

import {
  Card,
  Loading,
  ErrorState,
} from '../../components/ui';

import { useAuth } from '../auth/store';

export function ChatSessionInitializer({
  activityId,
  children,
}) {
  const userId = useAuth((state) => state.user?.id);

  const sessionQuery = useQuery({
    queryKey: [
      'chat-session-entry',
      String(userId),
      String(activityId),
    ],

    queryFn: () => api.enterActivity(activityId),

    enabled: Boolean(userId && activityId),

    // Do not automatically repeat the POST
    // when the browser window regains focus.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  if (sessionQuery.isPending) {
    return (
      <Card className="p-6">
        <Loading />

        <p className="mt-3 text-sm text-slate-500">
          Opening your chat session...
        </p>
      </Card>
    );
  }

  if (sessionQuery.isError) {
    return (
      <Card className="p-6">
        <ErrorState
          error={sessionQuery.error}
          retry={() => sessionQuery.refetch()}
        />
      </Card>
    );
  }

  if (!sessionQuery.data?.id) {
    return (
      <Card className="p-6">
        <p>Unable to initialize chat session.</p>
      </Card>
    );
  }

  return children(sessionQuery.data);
}
