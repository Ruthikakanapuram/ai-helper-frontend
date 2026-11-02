
import React, { useEffect, useRef } from 'react';import { getAccessToken, ROOT } from '../../lib/api';

type ActivityEvent = {
  type: string;
  activityId: string;
  studentId: string;
  userId: string;
  sessionId: string;
  messageId: string;
  [key: string]: any;
};

type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected';

export function useActivitySse(
  activityId: string | number,
  callback: (event: ActivityEvent) => void,
  onReconnect?: () => void,
) {
  const handler = useRef(callback);
  const reconnectHandler = useRef(onReconnect);
const [status, setStatus] = React.useState('disconnected');
  handler.current = callback;
  reconnectHandler.current = onReconnect;

  useEffect(() => {
    if (!activityId) {
      setStatus('disconnected');
      return;
    }

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let retryDelay = 1000;
    let hasConnectedBefore = false;

    const connect = async () => {
      if (stopped) return;

      const token = getAccessToken();

      if (!token) {
        setStatus('disconnected');
        return;
      }

      controller = new AbortController();
      setStatus('connecting');

      try {
        const response = await fetch(
          `${ROOT}/activities/${encodeURIComponent(
            String(activityId),
          )}/events`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'text/event-stream',
            },
            cache: 'no-cache',
            signal: controller.signal,
          },
        );

        if (response.status === 401 || response.status === 403) {
          setStatus('disconnected');
          return;
        }

        if (!response.ok) {
          throw new Error(
            `SSE connection failed: ${response.status}`,
          );
        }

        if (!response.body) {
          throw new Error('SSE response stream unavailable');
        }

        setStatus('connected');
        retryDelay = 1000;

        if (hasConnectedBefore) {
          reconnectHandler.current?.();
        }

        hasConnectedBefore = true;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';

        const processEvent = (rawEvent: string) => {
          let eventType = 'message';
          const dataLines: string[] = [];

          for (const line of rawEvent.split(/\r?\n/)) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trimStart());
            }
          }

          if (!dataLines.length) return;

          try {
            const eventData = JSON.parse(dataLines.join('\n'));

            handler.current?.({
              ...eventData,
              type: eventData.type || eventType,
            });
          } catch (error) {
            console.error('Invalid SSE event:', error);
          }
        };

        while (!stopped) {
          const { value, done } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() || '';

          for (const block of blocks) {
            if (block.trim()) {
              processEvent(block);
            }
          }
        }

        if (!stopped) {
          throw new Error('SSE connection closed');
        }
      } catch (error: any) {
        if (stopped || error.name === 'AbortError') return;

        console.error('Activity SSE error:', error);

        setStatus('disconnected');

        reconnectTimer = setTimeout(() => {
          connect();
        }, retryDelay);

        retryDelay = Math.min(retryDelay * 2, 15000);
      }
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      controller?.abort();
    };
  }, [activityId]);

  return status;
}
