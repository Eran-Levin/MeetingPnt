import { createBrowserRouter } from 'react-router-dom';
import { AuthenticatedLayout } from '../components/AuthenticatedLayout.js';
import { RequireRole } from '../components/RequireRole.js';
import { UsersPage } from '../pages/admin/UsersPage.js';
import { ActivityCreatePage } from '../pages/leader/ActivityCreatePage.js';
import { AnalysisPage } from '../pages/leader/AnalysisPage.js';
import { EventsPage } from '../pages/leader/EventsPage.js';
import { ActivityDetailPage } from '../pages/leader/ActivityDetailPage.js';
import { GroupDetailPage } from '../pages/leader/GroupDetailPage.js';
import { GroupsPage } from '../pages/leader/GroupsPage.js';
import { HomeRedirect } from '../pages/HomeRedirect.js';
import { InvitePage } from '../pages/InvitePage.js';
import { LoginPage } from '../pages/LoginPage.js';

export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  // Public: an invitation link is opened by someone who has no account yet.
  { path: '/invite', element: <InvitePage /> },
  {
    element: <AuthenticatedLayout />,
    children: [
      {
        element: <RequireRole roles={['leader', 'admin']} />,
        children: [
          { path: '/groups', element: <GroupsPage /> },
          { path: '/events', element: <EventsPage /> },
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
]);
