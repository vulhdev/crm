import { LayoutDashboard, Users, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
}

function NavItem({ icon, label, href, active }: NavItemProps) {
  return (
    <a
      href={href}
      className={[
        'relative h-9 px-2.5 rounded-md flex items-center gap-2.5 no-underline',
        'font-["DM_Sans"] font-medium text-[13.5px] transition-colors',
        active
          ? 'bg-[#1A7A6E]/[0.18] text-[#2AA99A]'
          : 'text-white/65 hover:bg-white/[0.06] hover:text-white/90',
      ].join(' ')}
    >
      {active && (
        <span className="absolute left-0 h-4 w-0.5 bg-[#1A7A6E] rounded-r" />
      )}
      <span className="flex items-center">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const path = window.location.pathname;

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  return (
    <aside className="w-[248px] h-screen flex flex-col bg-[#0D1F2D] border-r border-white/[0.06] sticky top-0 shrink-0">
      {/* Brand */}
      <div className="h-16 px-5 flex items-center gap-3">
        <div className="grid grid-cols-2 gap-0.5 w-[18px] h-[18px] shrink-0">
          <div className="bg-[#1A7A6E] rounded-[2px]" />
          <div className="bg-[#2AA99A] rounded-[2px]" />
          <div className="bg-[#3D5BD9] rounded-[2px]" />
          <div className="bg-[#6B6560] rounded-[2px]" />
        </div>
        <span
          className="font-['Plus_Jakarta_Sans'] font-semibold text-[14px] text-[#F7F6F3]"
        >
          CRM Platform
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 pt-2 px-3">
        <p className="px-2.5 pt-4 pb-1.5 text-[10px] uppercase tracking-widest text-white/35 font-['DM_Sans']">
          Workspace
        </p>
        <div className="flex flex-col gap-0.5">
          <NavItem
            icon={<LayoutDashboard size={15} />}
            label="Dashboard"
            href="/"
            active={path === '/'}
          />
          <NavItem
            icon={<Users size={15} />}
            label="Customers"
            href="/customers"
            active={path === '/customers' || path.startsWith('/customers')}
          />
        </div>
      </nav>

      {/* User footer */}
      <div className="py-4 px-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#1A7A6E]/30 text-[#2AA99A] flex items-center justify-center text-[11px] font-['DM_Sans'] font-medium shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-['DM_Sans'] font-medium text-[13px] text-white/80 truncate">
              {fullName}
            </p>
            <p className="font-['DM_Sans'] text-[11.5px] text-white/45 truncate">
              {user?.email ?? ''}
            </p>
          </div>
          <button
            onClick={logout}
            className="ml-auto p-1.5 rounded-md text-white/35 hover:text-[#C94040] transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
