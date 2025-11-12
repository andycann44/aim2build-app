import { ReactNode } from 'react';

type RouteKey = '/' | '/my-sets' | '/wishlist' | '/inventory' | '/buildability';

type LayoutProps = {
  currentRoute: RouteKey;
  onNavigate: (route: RouteKey) => void;
  children: ReactNode;
};

const navLinks: { to: RouteKey; label: string }[] = [
  { to: '/', label: 'Search' },
  { to: '/my-sets', label: 'My Sets' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/buildability', label: 'Buildability' }
];

export default function Layout({ currentRoute, onNavigate, children }: LayoutProps): JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container">
          <h1>Aim2Build</h1>
          <p>Track your LEGO® catalog, manage your bricks, and see what you can build.</p>
          <nav aria-label="Primary navigation">
            <ul>
              {navLinks.map((link) => {
                const isActive = currentRoute === link.to;
                return (
                  <li key={link.to}>
                    <button
                      type="button"
                      className="nav-link"
                      data-active={isActive ? 'true' : 'false'}
                      onClick={() => onNavigate(link.to)}
                    >
                      <span>{link.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>
      <main className="container">{children}</main>
    </div>
  );
}
