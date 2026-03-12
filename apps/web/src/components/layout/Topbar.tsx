import { useAuth } from '@/contexts/AuthContext';

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const { user, logout } = useAuth();
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  return (
    <header className="h-14 sticky top-0 z-10 bg-[#F7F6F3]/90 backdrop-blur-sm border-b border-[#E2DED9] px-6 flex items-center justify-between">
      <h2 className="font-['Plus_Jakarta_Sans'] font-semibold text-[17px] text-[#141210]">
        {title}
      </h2>
      <div className="flex items-center gap-3">
        <span className="font-['DM_Sans'] text-[13px] text-[#6B6560]">
          {fullName}
        </span>
        <div className="w-px h-4 bg-[#E2DED9]" />
        <button
          onClick={logout}
          className="font-['DM_Sans'] font-medium text-[13px] text-[#6B6560] hover:text-[#C94040] transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
