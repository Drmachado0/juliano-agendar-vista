import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { afterEach } from 'vitest';
import GuiaSaudeOcular from './GuiaSaudeOcular';
import GuiaArtigo from './GuiaArtigo';
import LocaisAtendimento from './LocaisAtendimento';
import { GUIA_ARTIGOS } from '@/lib/guia';
import { LOCATIONS } from '@/lib/locations';

vi.mock('@/components/Header', () => ({default: () => <nav>Menu</nav>}));
vi.mock('@/components/Footer', () => ({default: () => <footer>Rodapé</footer>}));
vi.mock('@/hooks/useSiteWhatsApp', () => ({useSiteWhatsApp: () => ({waLink: () => 'https://wa.me/5591936180476'})}));
vi.mock('@/hooks/useGoogleTag', () => ({useGoogleTag: () => ({trackWhatsAppClick: vi.fn()})}));
vi.mock('@/hooks/useGuiaReading', () => ({useGuiaReading: vi.fn()}));
afterEach(cleanup);
const mount = (element: React.ReactNode) => render(<HelmetProvider><MemoryRouter>{element}</MemoryRouter></HelmetProvider>);

describe('guia público do domínio principal', () => {
  it('busca, filtra por tema e recupera uma busca vazia', () => {
    const {container} = mount(<GuiaSaudeOcular />);
    expect(container.querySelectorAll('.guide-card')).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', {name:'Olho seco'}));
    expect(container.querySelectorAll('.guide-card')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox'), {target:{value:'inexistente'}});
    expect(screen.getByText(/Nenhum artigo encontrado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Ver todos os artigos'}));
    expect(container.querySelectorAll('.guide-card')).toHaveLength(7);
  });
  it.each(GUIA_ARTIGOS.map(a => [a.slug, a.titulo]))('renderiza %s com revisão, fonte e sumário completo', (slug, title) => {
    const {container} = mount(<GuiaArtigo slug={slug} />);
    expect(screen.getByRole('heading', {level:1, name:title})).toBeInTheDocument();
    expect(screen.getByText(/Revisão médica:/)).toHaveTextContent('CRM-PA 15253');
    expect(container.querySelector('figure img')).toHaveAttribute('srcset');
    for (const link of container.querySelectorAll('a[href^="#"]')) {
      expect(container.querySelector('[id="'+link.getAttribute('href')!.slice(1)+'"]')).not.toBeNull();
    }
    expect(screen.getByRole('link', {name:'Agendar avaliação'})).toHaveAttribute('href','/agendamento');
  });
  it('mantém os quatro endereços e mapas da fonte canônica', () => {
    mount(<LocaisAtendimento />);
    for (const l of LOCATIONS) expect(screen.getByText(l.name)).toBeInTheDocument();
    expect(screen.getAllByRole('link', {name:'Abrir mapa'}).map(a => a.getAttribute('href'))).toEqual(LOCATIONS.map(l => l.mapsLink));
  });
});
