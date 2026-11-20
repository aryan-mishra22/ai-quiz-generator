import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FileClock,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';

const navigation = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Create Quiz', to: '/create-quiz', icon: Sparkles },
  { label: 'My Quizzes', to: '/quizzes', icon: FileText },
  { label: 'PDF Library', to: '/documents', icon: FileText },
  { label: 'History', to: '/history', icon: FileClock },
  { label: 'Settings', to: '/settings', icon: Settings },
];

const pageTitles = {
  '/': 'Dashboard',
  '/create-quiz': 'Create a quiz',
  '/quizzes': 'My quizzes',
  '/documents': 'PDF library',
  '/history': 'Activity history',
  '/settings': 'Settings',
};

export default function AppShell({ theme }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const title = location.pathname.startsWith('/quiz/') ? 'Quiz practice' : (pageTitles[location.pathname] || 'QuizAI');

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-nav-open' : ''}`} data-theme={theme}>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={closeMobile} />}
      <aside className="sidebar">
        <div className="brand-row">
          <Link className="brand" to="/" onClick={closeMobile}>
            <span className="brand-mark"><Sparkles size={19} fill="currentColor" /></span>
            {!collapsed && <span className="brand-name">Quiz<span>AI</span></span>}
          </Link>
          <button className="icon-button collapse-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
          <button className="icon-button close-mobile" aria-label="Close navigation" onClick={closeMobile}><X size={18} /></button>
        </div>

        <div className="sidebar-label">{!collapsed && 'WORKSPACE'}</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              onClick={closeMobile}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} strokeWidth={1.8} />
              {!collapsed && <span>{label}</span>}
              {label === 'PDF Library' && !collapsed && <span className="nav-count">3</span>}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="sidebar-tip">
            <div className="tip-glow"><Sparkles size={17} /></div>
            <strong>Learning, made personal</strong>
            <p>Turn your notes into a practice session in seconds.</p>
            <button onClick={() => { navigate('/create-quiz'); closeMobile(); }}>
              Create a quiz <ChevronRight size={15} />
            </button>
          </div>
        )}

        <div className="sidebar-bottom">
          <button className="profile-button" onClick={() => { navigate('/settings'); closeMobile(); }} title="Open settings">
            <span className="avatar">JD</span>
            {!collapsed && (
              <span className="profile-copy">
                <strong>Jamie Davis</strong>
                <small>Free plan</small>
              </span>
            )}
            {!collapsed && <ChevronRight className="profile-chevron" size={16} />}
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{title}</strong></div>
          </div>
          <div className="topbar-actions">
            <button
              className={`icon-button notification-button ${notificationsOpen ? 'selected' : ''}`}
              aria-label="Notifications"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            {notificationsOpen && (
              <div className="notification-popover">
                <div className="notification-title"><strong>Notifications</strong><span>1 new</span></div>
                <p><span className="notification-mini"><Sparkles size={14} /></span>Your learning dashboard is ready to explore.</p>
                <button onClick={() => setNotificationsOpen(false)}>Got it</button>
              </div>
            )}
            <span className="topbar-divider" />
            <button className="topbar-user" onClick={() => navigate('/settings')} aria-label="Open profile settings">
              <span className="avatar small">JD</span>
              <span className="topbar-user-name">Jamie Davis</span>
            </button>
          </div>
        </header>
        <main className="content-area">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>© 2025 QuizAI</span>
          <span>Built for curious minds <Sparkles size={13} /></span>
        </footer>
      </div>
    </div>
  );
}
