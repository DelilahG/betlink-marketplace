import { useEffect, useState } from 'react';
import { Heart, LayoutDashboard, LogOut, Menu, Plus, Shield, User as UserIcon, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { canList, useAuth } from '../auth';
import { t } from '../i18n';

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 32 32"><path d="M4 28V12L16 4l12 8v16h-8v-9h-8v9z" fill="#f4efe6" /></svg>
    </span>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    setNavOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className={`site-header ${scrolled || location.pathname !== '/' ? 'scrolled' : ''}`}>
      <div className="container bar">
        <Link to="/" className="brand" aria-label="BetLink home"><BrandMark /> BETLINK</Link>
        <nav className={`nav ${navOpen ? 'open' : ''}`} aria-label="Main">
          <NavLink to="/rent">{t('nav.rent')}</NavLink>
          <NavLink to="/buy">{t('nav.buy')}</NavLink>
          {canList(user) && <NavLink to="/dashboard">{t('nav.dashboard')}</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
        </nav>
        <div className="header-actions">
          <Link to={canList(user) ? '/dashboard/new' : user ? '/account?tab=profile' : '/register?role=owner'} className="btn btn-ghost btn-sm hide-mobile">
            <Plus size={16} aria-hidden /> {t('nav.list')}
          </Link>
          {user ? (
            <div className="user-menu">
              <button className="avatar" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} aria-label="Account menu">
                {user.full_name.trim().charAt(0).toUpperCase()}
              </button>
              {menuOpen && (
                <div className="panel" role="menu">
                  <div className="tiny muted" style={{ padding: '8px 12px' }}>{user.email}</div>
                  <Link role="menuitem" to="/account"><UserIcon size={16} /> {t('nav.account')}</Link>
                  <Link role="menuitem" to="/account?tab=saved"><Heart size={16} /> Saved homes</Link>
                  {canList(user) && <Link role="menuitem" to="/dashboard"><LayoutDashboard size={16} /> {t('nav.dashboard')}</Link>}
                  {user.role === 'admin' && <Link role="menuitem" to="/admin"><Shield size={16} /> {t('nav.admin')}</Link>}
                  <button role="menuitem" onClick={async () => { await logout(); navigate('/'); }}><LogOut size={16} /> {t('nav.logout')}</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm hide-mobile">{t('nav.login')}</Link>
              <Link to="/register" className="btn btn-sm">{t('nav.register')}</Link>
            </>
          )}
          <button className="icon-btn menu-toggle" aria-label="Toggle menu" aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)}>
            {navOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="brand"><BrandMark /> BETLINK</Link>
            <p className="muted small" style={{ maxWidth: 360, marginTop: 16 }}>
              Connecting people to homes and property opportunities across Ethiopia. BetLink is a discovery and inquiry
              platform — we never take payments. Always view a property and check documents before paying anyone.
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <Link to="/rent">Homes for rent</Link>
            <Link to="/buy">Property for sale</Link>
            <Link to="/rent?q=Bole">Bole</Link>
            <Link to="/buy?region=Oromia">Oromia</Link>
          </div>
          <div>
            <h4>Owners & agents</h4>
            <Link to="/register?role=owner">List a property</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
          <div>
            <h4>Account</h4>
            <Link to="/account">Profile</Link>
            <Link to="/account?tab=saved">Saved homes</Link>
            <Link to="/account?tab=inquiries">My inquiries</Link>
          </div>
        </div>
        <div className="footer-legal tiny muted">
          <span>© {new Date().getFullYear()} BetLink · Student portfolio project · Prices in Ethiopian birr (ETB)</span>
          <span>Demo photography from <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash</a> — illustrative only</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, which must not become the effect's cleanup
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
