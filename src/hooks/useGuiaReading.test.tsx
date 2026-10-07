import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useGuiaReading } from './useGuiaReading';
import { trackGuiaEvent } from '@/lib/guiaAnalytics';
import { isAnalyticsAllowed } from '@/lib/trackingGuard';
import { CONSENT_CHANGED_EVENT } from '@/lib/consent';
vi.mock('@/lib/guiaAnalytics', () => ({ trackGuiaEvent: vi.fn() }));
vi.mock('@/lib/trackingGuard', () => ({ isAnalyticsAllowed: vi.fn(() => true) }));
let visibility = 'visible', top = 0;
const oldVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); vi.mocked(isAnalyticsAllowed).mockReturnValue(true);
  visibility = 'visible'; top = 0;
  Object.defineProperty(document,'visibilityState',{ configurable:true,get:()=>visibility });
});
afterEach(() => { cleanup(); vi.useRealTimers(); if (oldVisibility) Object.defineProperty(document,'visibilityState',oldVisibility); });
const mount = () => renderHook(() => useGuiaReading('olho-seco', {current:{getBoundingClientRect:()=>({top,height:1000})} as HTMLElement}));
const reads = () => vi.mocked(trackGuiaEvent).mock.calls.filter(c => c[0] === 'ocular_article_read');
describe('leitura estimada dos artigos', () => {
  it('exige 30 segundos e dispara uma vez por visita', () => {
    mount();act(()=>vi.advanceTimersByTime(29000));expect(reads()).toHaveLength(0);
    act(()=>vi.advanceTimersByTime(1000));expect(reads()).toHaveLength(1);
    act(()=>vi.advanceTimersByTime(60000));expect(reads()).toHaveLength(1);
  });
  it('não conta tempo em aba oculta e exige metade do texto alcançada', () => {
    visibility='hidden';mount();act(()=>vi.advanceTimersByTime(60000));expect(reads()).toHaveLength(0);
    visibility='visible';top=800;act(()=>vi.advanceTimersByTime(30000));expect(reads()).toHaveLength(0);
    top=-300;act(()=>vi.advanceTimersByTime(1000));expect(reads()).toHaveLength(1);
  });
  it('aceitar consentimento depois não duplica a visualização nem antecipa leitura', () => {
    vi.mocked(isAnalyticsAllowed).mockReturnValue(false);mount();act(()=>vi.advanceTimersByTime(30000));expect(trackGuiaEvent).not.toHaveBeenCalled();
    vi.mocked(isAnalyticsAllowed).mockReturnValue(true);
    act(()=>window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT)));
    act(()=>window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT)));
    expect(vi.mocked(trackGuiaEvent).mock.calls.filter(c=>c[0]==='ocular_article_view')).toHaveLength(1);
    act(()=>vi.advanceTimersByTime(29000));expect(reads()).toHaveLength(0);
    act(()=>vi.advanceTimersByTime(1000));expect(reads()).toHaveLength(1);
  });
});
