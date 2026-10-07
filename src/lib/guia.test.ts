import { describe, it, expect, vi, afterEach } from 'vitest';
import { GUIA_ARTIGOS, filtrarArtigos } from './guia';
import { trackGuiaEvent, rememberGuiaSource, trackGuiaAppointmentSuccess } from './guiaAnalytics';

const originalWindow = window;
afterEach(() => vi.unstubAllGlobals());
describe('guia aprovado do domínio principal', () => {
  it('mantém sete textos revisados e imagens locais, sem domínio de teste', () => {
    expect(GUIA_ARTIGOS).toHaveLength(7);
    for (const a of GUIA_ARTIGOS) {
      expect(a.estado).toBe('publicado');
      expect(a.revisao_medica.crm).toBe('CRM-PA 15253');
      expect(a.html).not.toMatch(/drjulianomachado\.site|\.html"/);
      expect(a.imagem.src).toMatch(/^\/images\/guia\/.*\.webp$/);
    }
  });
  it('busca sem acentos e combina o tema com a busca', () => {
    expect(filtrarArtigos('visao embacada', 'Todos').some(a => a.slug === 'visao-embacada')).toBe(true);
    expect(filtrarArtigos('DIABETES', 'Diabetes e visão').map(a => a.slug)).toEqual(['diabetes-saude-ocular']);
    expect(filtrarArtigos('catarata', 'Olho seco')).toEqual([]);
  });
});
describe('eventos de leitura do GA4', () => {
  function setup(consent: boolean, host = 'drjulianomachado.com') {
    const gtag = vi.fn();
    originalWindow.sessionStorage.clear();
    originalWindow.localStorage.setItem('lgpd-consent', JSON.stringify({necessary:true, analytics:consent, marketing:false, version:'1.0'}));
    vi.stubGlobal('window', {location:new URL('https://' + host + '/guia/olho-seco'),localStorage:originalWindow.localStorage,sessionStorage:originalWindow.sessionStorage,gtag});
    return gtag;
  }
  it('não envia nada sem consentimento analytics ou em domínio de teste', () => {
    let gtag = setup(false);trackGuiaEvent('ocular_article_view', 'olho-seco');expect(gtag).not.toHaveBeenCalled();
    gtag = setup(true, 'drjulianomachado.site');trackGuiaEvent('ocular_article_view', 'olho-seco');expect(gtag).not.toHaveBeenCalled();
  });
  it('envia somente metadados editoriais para a propriedade existente', () => {
    const gtag = setup(true);trackGuiaEvent('ocular_article_read', 'olho-seco');
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0]).toEqual(['event','ocular_article_read',{send_to:'G-79BDCX4R2L',article_slug:'olho-seco',article_category:'Olho seco'}]);
    trackGuiaEvent('ocular_article_read', 'inexistente');expect(gtag).toHaveBeenCalledTimes(1);
  });
  it('atribui a reserva concluída ao artigo e consome a origem uma única vez', () => {
    const gtag = setup(true);
    rememberGuiaSource('olho-seco');
    trackGuiaAppointmentSuccess(); trackGuiaAppointmentSuccess();
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0]).toEqual(['event','ocular_article_appointment_success',{send_to:'G-79BDCX4R2L',article_slug:'olho-seco',article_category:'Olho seco'}]);
  });
  it('não armazena origem sem consentimento', () => {
    setup(false);rememberGuiaSource('olho-seco');
    expect(originalWindow.sessionStorage.getItem('ocular_article_source')).toBeNull();
  });

});
