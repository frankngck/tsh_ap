import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ALL_ROLES_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/suppliers', label: 'Suppliers' },
  { to: '/bills',     label: 'Bills' },
  { to: '/payments',  label: 'Payments' },
  { to: '/reports',   label: 'Reports' },
];

const ROLE_EXTRA_LINKS = {
  admin:   [
    { to: '/purchase-orders', label: 'Purchase Orders' },
    { to: '/three-way-match', label: '3-Way Match' },
    { to: '/ai-reports',      label: 'AI Reports' },
    { to: '/reminders',       label: 'Reminders' },
  ],
  clerk:   [
    { to: '/purchase-orders', label: 'Purchase Orders' },
    { to: '/reminders',       label: 'Reminders' },
  ],
  manager: [
    { to: '/three-way-match', label: '3-Way Match' },
    { to: '/ai-reports',      label: 'AI Reports' },
  ],
};

const ROLE_BADGE = {
  admin:   { label: 'ADMIN',   bg: '#7C3AED', color: '#fff' },
  clerk:   { label: 'CLERK',   bg: '#0F766E', color: '#fff' },
  manager: { label: 'MANAGER', bg: '#B45309', color: '#fff' },
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const role      = user?.role;
  const navLinks  = [...ALL_ROLES_LINKS, ...(ROLE_EXTRA_LINKS[role] || [])];
  const badge     = ROLE_BADGE[role];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/dashboard" className="navbar-brand">TSH AP</Link>

        <button
          className="navbar-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>

        <div className={`navbar-nav${menuOpen ? ' open' : ''}`}>
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link${isActive(to) ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="navbar-actions">
          {user && (
            <span className="navbar-user">{user.name || user.email}</span>
          )}
          {badge && (
            <span style={{
              display:       'inline-block',
              padding:       '2px 8px',
              borderRadius:  10,
              fontSize:      11,
              fontWeight:    700,
              letterSpacing: '0.5px',
              background:    badge.bg,
              color:         badge.color,
              marginRight:   6,
            }}>
              {badge.label}
            </span>
          )}
          <button className="btn btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
