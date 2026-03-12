import { useAuth } from '@/contexts/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">CRM Platform</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="p-6">
        <p className="text-gray-500">Dashboard coming in Phase 3.</p>
      </main>
    </div>
  );
}
