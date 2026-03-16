import { Navigate, Route, Routes } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { AppLayout } from '@app/layouts/AppLayout';
import { ProtectedRoute } from '@app/routes/ProtectedRoute';
import { RoleRoute } from '@app/routes/RoleRoute';
import {
  AdminPage,
  AuthPage,
  ContractorRequestDetailsPage,
  CreateRequestPage,
  FeedbackPage,
  OfferWorkspacePage,
  ProjectManagerDashboardPage,
  RequestDetailsPage,
  RequestsPage,
  TgRegisterPage,
  VerifyEmailPage
} from '@pages/index';
import { ROLE } from '@shared/constants/roles';

type AppRoutesProps = {
  defaultPath: string;
  hasSession: boolean;
  roleId?: number;
  location: Location;
  backgroundLocation?: Location;
};

export const AppRoutes = ({ defaultPath, hasSession, roleId, location, backgroundLocation }: AppRoutesProps) => {
  return (
    <>
      <Routes location={backgroundLocation ?? location}>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/auth/login" element={<AuthPage />} />
        <Route path="/auth/tg/register" element={<TgRegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
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
                roleId === ROLE.PROJECT_MANAGER ? (
                  <Navigate to="/pm-dashboard" replace />
                ) : (
                  <RoleRoute allowedRoles={[ROLE.SUPERADMIN, ROLE.ADMIN, ROLE.LEAD_ECONOMIST]}>
                    <AdminPage />
                  </RoleRoute>
                )
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
            <Route
              path="/pm-dashboard"
              element={
                <RoleRoute allowedRoles={[ROLE.PROJECT_MANAGER]}>
                  <ProjectManagerDashboardPage />
                </RoleRoute>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={hasSession ? defaultPath : '/login'} replace />} />
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
