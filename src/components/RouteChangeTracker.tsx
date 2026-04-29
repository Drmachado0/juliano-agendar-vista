import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const isAdminPath = (pathname: string) => pathname.startsWith('/admin');

const RouteChangeTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (isAdminPath(location.pathname)) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'virtualPageview',
      page_path: location.pathname,
      page_title: document.title,
    });
  }, [location]);

  return null;
};

export default RouteChangeTracker;

