import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import {
  CheckSquare,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { logout, selectUser } from '@/features/auth/authSlice';
import { fetchMyTaskCounts, selectMyTaskCounts } from '@/features/reminders/remindersSlice';
import { Avatar } from '@/components/ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/deals', label: 'Deals', icon: KanbanSquare },
  { to: '/tasks', label: 'To-do list', icon: CheckSquare, badge: 'tasks' },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ item, badgeCount, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {badgeCount > 0 && (
        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
          {badgeCount}
        </span>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const counts = useSelector(selectMyTaskCounts);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Re-count on every navigation so the badge reflects tasks completed elsewhere
  // in the app. This reads its own state slot, so page filters never skew it.
  useEffect(() => {
    dispatch(fetchMyTaskCounts());
    setMobileOpen(false);
  }, [dispatch, location.pathname]);

  const badgeFor = (item) => (item.badge === 'tasks' ? counts.overdue : 0);

  const sidebar = (
    <div className="flex h-full flex-col gap-1 px-3 py-4">
      <div className="mb-4 flex items-center gap-2 px-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          S
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-slate-900">Spector.AI CRM</p>
          <p className="text-[11px] leading-tight text-slate-500">Deals &amp; follow-ups</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            badgeCount={badgeFor(item)}
            onNavigate={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      <div className="mt-2 border-t border-slate-200 pt-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Avatar name={user?.name || '?'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dispatch(logout())}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 animate-fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative z-10 h-full w-72 max-w-[85%] bg-white shadow-lift">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-slate-900">Spector.AI CRM</span>
          {counts.overdue > 0 && (
            <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
              {counts.overdue} overdue
            </span>
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
