import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout';
import BuildabilityPage from './pages/BuildabilityPage';
import InventoryPage from './pages/InventoryPage';
import MySetsPage from './pages/MySetsPage';
import SearchPage from './pages/SearchPage';
import WishlistPage from './pages/WishlistPage';

type RouteKey = '/' | '/my-sets' | '/wishlist' | '/inventory' | '/buildability';

const defaultRoute: RouteKey = '/';

function parseRoute(): RouteKey {
  const path = window.location.pathname as RouteKey;
  if (path === '/my-sets' || path === '/wishlist' || path === '/inventory' || path === '/buildability') {
    return path;
  }
  return defaultRoute;
}

export default function App(): JSX.Element {
  const [route, setRoute] = useState<RouteKey>(() => parseRoute());

  useEffect(() => {
    const handler = () => {
      setRoute(parseRoute());
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = useCallback(
    (path: RouteKey) => {
      if (path === route) {
        return;
      }
      window.history.pushState({}, '', path);
      setRoute(path);
    },
    [route]
  );

  const page = useMemo(() => {
    switch (route) {
      case '/my-sets':
        return <MySetsPage />;
      case '/wishlist':
        return <WishlistPage />;
      case '/inventory':
        return <InventoryPage />;
      case '/buildability':
        return <BuildabilityPage />;
      default:
        return <SearchPage />;
    }
  }, [route]);

  return (
    <Layout currentRoute={route} onNavigate={navigate}>
      {page}
    </Layout>
  );
}
