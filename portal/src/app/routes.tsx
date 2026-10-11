import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { isMarketingHost } from '../lib/site.js';
import { MarketingGate } from '../pages/MarketingGate.js';
import { ToApp } from '../pages/ToApp.js';
import { AuthenticatedLayout } from '../components/AuthenticatedLayout.js';
import { RequireRole } from '../components/RequireRole.js';
import { UsersPage } from '../pages/admin/UsersPage.js';
import { ActivityCreatePage } from '../pages/leader/ActivityCreatePage.js';
import { AnalysisPage } from '../pages/leader/AnalysisPage.js';
import { ActivitiesPage } from '../pages/leader/ActivitiesPage.js';
import { ActivityDetailPage } from '../pages/leader/ActivityDetailPage.js';
import { GroupDetailPage } from '../pages/leader/GroupDetailPage.js';
import { GroupsPage } from '../pages/leader/GroupsPage.js';
import { HomeRedirect } from '../pages/HomeRedirect.js';
import { InvitePage } from '../pages/InvitePage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { RegisterPage } from '../pages/RegisterPage.js';

const appRoutes: RouteObject[] = [
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  // Public: an invitation link is opened by someone who has no account yet.
  { path: '/invite', element: <InvitePage /> },
  {
    element: <AuthenticatedLayout />,
    children: [
      {
        element: <RequireRole roles={['leader', 'admin']} />,
        children: [
          { path: '/groups', element: <GroupsPage /> },
          { path: '/activities', element: <ActivitiesPage /> },
          { path: '/analysis', element: <AnalysisPage /> },
          { path: '/groups/:id', element: <GroupDetailPage /> },
          { path: '/groups/:groupId/activities/new', element: <ActivityCreatePage /> },
          { path: '/activities/:id', element: <ActivityDetailPage /> },
        ],
      },
      {
        element: <RequireRole roles={['admin']} />,
        children: [{ path: '/admin/users', element: <UsersPage /> }],
      },
    ],
  },
];

// `www.` is the landing page and nothing else; any other path there is really an app path.
const marketingRoutes: RouteObject[] = [
  { path: '/', element: <MarketingGate /> },
  { path: '*', element: <ToApp /> },
];

export const router = createBrowserRouter(isMarketingHost ? marketingRoutes : appRoutes);
