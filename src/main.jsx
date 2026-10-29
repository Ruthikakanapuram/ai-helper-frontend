import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { router } from './routes/router';
import { queryClient } from './lib/query';
import './index.css';
async function bootstrap() { if (import.meta.env.VITE_USE_MOCKS !== 'false') {
    const { startMocks } = await import('./mocks/browser');
    await startMocks();
} const el = document.getElementById('root'); if (!el)
    throw new Error('Root element missing'); createRoot(el).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router}/><Toaster richColors position="top-right"/></QueryClientProvider></React.StrictMode>); }
void bootstrap();
