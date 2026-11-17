import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Bootstrap } from './app/Bootstrap.js';
import { router } from './app/routes.js';
import { ToastProvider } from './components/ui/Toast.js';
import './i18n/index.js';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Bootstrap>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </Bootstrap>
    </QueryClientProvider>
  </StrictMode>,
);
