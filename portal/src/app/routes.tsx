import { createBrowserRouter } from 'react-router-dom';
import { RequireRole } from '../components/RequireRole.js';
import { UsersPage } from '../pages/admin/UsersPage.js';
import { ActivityCreatePage } from '../pages/leader/ActivityCreatePage.js';
import { ActivityDetailPage } from '../pages/leader/ActivityDetailPage.js';
import { GroupDetailPage } from '../pages/leader/GroupDetailPage.js';
import { GroupsPage } from '../pages/leader/GroupsPage.js';
import { HomeRedirect } from '../pages/HomeRedirect.js';
import { LoginPage } from '../pages/LoginPage.js';

export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireRole roles={['leader', 'admin']} />,
    children: [
      { path: '/groups', element: <GroupsPage /> },
      { path: '/groups/:id', element: <GroupDetailPage /> },
      { path: '/groups/:groupId/activities/new', element: <ActivityCreatePage /> },
      { path: '/activities/:id', element: <ActivityDetailPage /> },
    ],
  },
  {
    element: <RequireRole roles={['admin']} />,
    children: [{ path: '/admin/users', element: <UsersPage /> }],
  },
]);
