import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { safeDataLayerPush } from '@/lib/trackingGuard';

const RouteChangeTracker = () => {
  const location = useLocation();

  useEffect(() => {
    safeDataLayerPush({
      event: 'virtualPageview',
      page_path: location.pathname,
      page_title: document.title,
    });
  }, [location]);

  return null;
};

export default RouteChangeTracker;
