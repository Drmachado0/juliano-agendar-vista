import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const RouteChangeTracker = () => {
  const location = useLocation();

  useEffect(() => {
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
