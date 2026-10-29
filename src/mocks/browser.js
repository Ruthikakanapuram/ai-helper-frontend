import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { startMockWebSocket } from './ws';
export const worker = setupWorker(...handlers);
export async function startMocks() { startMockWebSocket(); await worker.start({ onUnhandledRequest: 'bypass', quiet: true }); }
