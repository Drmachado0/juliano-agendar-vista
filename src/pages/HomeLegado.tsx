import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { BASE_URL } from '@/lib/locations';

/** Alias histórico /home/: HTML próprio evita servir a página 404 como home. */
export default function HomeLegado() {
  const location = useLocation();
  return <><Helmet><title>Dr. Juliano Machado | Página inicial</title><meta name="robots" content="noindex, follow" /><link rel="canonical" href={BASE_URL+'/'} /></Helmet><p><Link to={'/'+location.search+location.hash}>Ir para a página inicial do Dr. Juliano Machado</Link></p>{typeof window === 'undefined' ? null : <Navigate to={'/'+location.search+location.hash} replace />}</>;
}
