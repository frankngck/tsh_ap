import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/dashboard',       label: 'Dashboard' },
  { to: '/suppliers',       label: 'Suppliers' },
  { to: '/purchase-orders', label: 'Purchase Orders' },
  { to: '/bills',           label: 'Bills' },
  { to: '/three-way-match', label: '3-Way Match' },
  { to: '/payments',        label: 'Payments' },
  { to: '/reports',         label: 'Reports' },
  { to: '/ai-reports',      label: 'AI Reports' },
  { to: '/reminders',       label: 'Reminders' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/dashboard" className="navbar-brand">
          TSH AP
        </Link>

        <button
          className="navbar-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>

        <div className={`navbar-nav${menuOpen ? ' open' : ''}`}>
          {NAV_LINKS.map(({ to, label }) => (
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
          {user && <span className="navbar-user">{user.fullName || user.email}</span>}
          <button className="btn btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
