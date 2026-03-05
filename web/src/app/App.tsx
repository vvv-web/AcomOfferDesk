import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { AdminPage } from '@pages/AdminPage';
import { AuthPage } from '@pages/AuthPage';
import { CreateRequestPage } from '@pages/CreateRequestPage';
import { RequestDetailsPage } from '@pages/RequestDetailsPage';
import { RequestsPage } from '@pages/RequestsPage';
import { TgRegisterPage } from '@pages/TgRegisterPage';
import { ContractorRequestDetailsPage } from '@pages/ContractorRequestDetailsPage';
import { OfferWorkspacePage } from '@pages/OfferWorkspacePage';
import { FeedbackPage } from '@pages/FeedbackPage';
import { AppLayout } from '@app/layouts/AppLayout';
import { ProtectedRoute } from '@app/routes/ProtectedRoute';
import { RoleRoute } from '@app/routes/RoleRoute';
import { useAuth } from '@app/providers/AuthProvider';
import { ROLE } from '@shared/constants/roles';

export const App = () => {
  const { session } = useAuth();
  const location = useLocation();
  const state = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = state?.backgroundLocation;
  const defaultPath = session?.roleId === ROLE.SUPERADMIN || session?.roleId === ROLE.ADMIN ? '/admin' : '/requests';

  return (
    <>
      <Routes location={backgroundLocation ?? location}>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/auth/login" element={<AuthPage />} />
        <Route path="/auth/tg/register" element={<TgRegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to={defaultPath} replace />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/requests/create" element={<CreateRequestPage />} />
            <Route path="/requests/:id" element={<RequestDetailsPage />} />
            <Route path="/requests/:id/contractor" element={<ContractorRequestDetailsPage />} />
            <Route path="/offers/:id/workspace" element={<OfferWorkspacePage />} />
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={[ROLE.SUPERADMIN, ROLE.ADMIN, ROLE.LEAD_ECONOMIST]}>
                  <AdminPage />
                </RoleRoute>
              }
            />
            <Route
              path="/feedback"
              element={
                <RoleRoute allowedRoles={[ROLE.SUPERADMIN]}>
                  <FeedbackPage />
                </RoleRoute>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={session ? defaultPath : '/login'} replace />} />
      </Routes>

      {backgroundLocation ? (
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/requests/create" element={<CreateRequestPage />} />
          </Route>
        </Routes>
      ) : null}
    </>
  );

};