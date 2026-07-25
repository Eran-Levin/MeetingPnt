import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Bootstrap } from './app/Bootstrap.js';
import { router } from './app/routes.js';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Bootstrap>
        <RouterProvider router={router} />
      </Bootstrap>
    </QueryClientProvider>
  </StrictMode>,
);
