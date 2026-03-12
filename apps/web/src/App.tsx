import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { Toaster } from '@/components/ui/toaster';

function AppRoutes() {
  const { token } = useAuth();
  const path = window.location.pathname;

  if (path === '/auth/callback') {
    return <AuthCallbackPage />;
  }
  if (!token) {
    return <LoginPage />;
  }
  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster />
    </AuthProvider>
  );
}
