import { useState, useEffect } from "react";

// ===== CONSTANTES DE SEGURANÇA (Hard Rules - NÃO EDITÁVEIS) =====
export const LIMITE_SESSAO = 40;
export const LIMITE_DIARIO = 100;
export const HORARIO_INICIO_PADRAO = 9;
export const HORARIO_FIM_PADRAO = 18;

export interface EnvioLoteConfig {
  // Intervalos aleatórios entre mensagens
  intervaloMin: number;
  intervaloMax: number;
  // Pausas estratégicas
  pausarAposEnvios: number;
  pausaMinMin: number;
  pausaMaxMin: number;
  // Variação de texto
  variacaoTextoAtiva: boolean;
  // Configurações de horário
  modoEnvioSemRestricao: boolean;
  horarioInicio: number;
  horarioFim: number;
}

const CONFIG_PADRAO: EnvioLoteConfig = {
  intervaloMin: 45,
  intervaloMax: 120,
  pausarAposEnvios: 10,
  pausaMinMin: 5,
  pausaMaxMin: 10,
  variacaoTextoAtiva: true,
  modoEnvioSemRestricao: false,
  horarioInicio: HORARIO_INICIO_PADRAO,
  horarioFim: HORARIO_FIM_PADRAO,
};

const STORAGE_KEY = "envio_lote_config_avancada";

export function useEnvioLoteConfig() {
  // Intervalos aleatórios
  const [intervaloMin, setIntervaloMin] = useState(CONFIG_PADRAO.intervaloMin);
  const [intervaloMax, setIntervaloMax] = useState(CONFIG_PADRAO.intervaloMax);

  // Pausas estratégicas
  const [pausarAposEnvios, setPausarAposEnvios] = useState(CONFIG_PADRAO.pausarAposEnvios);
  const [pausaMinMin, setPausaMinMin] = useState(CONFIG_PADRAO.pausaMinMin);
  const [pausaMaxMin, setPausaMaxMin] = useState(CONFIG_PADRAO.pausaMaxMin);

  // Variação de texto
  const [variacaoTextoAtiva, setVariacaoTextoAtiva] = useState(CONFIG_PADRAO.variacaoTextoAtiva);

  // Configurações de horário
  const [modoEnvioSemRestricao, setModoEnvioSemRestricao] = useState(CONFIG_PADRAO.modoEnvioSemRestricao);
  const [horarioInicio, setHorarioInicio] = useState(CONFIG_PADRAO.horarioInicio);
  const [horarioFim, setHorarioFim] = useState(CONFIG_PADRAO.horarioFim);

  // Carregar configurações do localStorage
  useEffect(() => {
    const config = localStorage.getItem(STORAGE_KEY);
    if (config) {
      try {
        const parsed = JSON.parse(config);
        if (parsed.intervaloMin !== undefined) setIntervaloMin(parsed.intervaloMin);
        if (parsed.intervaloMax !== undefined) setIntervaloMax(parsed.intervaloMax);
        if (parsed.pausarAposEnvios !== undefined) setPausarAposEnvios(parsed.pausarAposEnvios);
        if (parsed.pausaMinMin !== undefined) setPausaMinMin(parsed.pausaMinMin);
        if (parsed.pausaMaxMin !== undefined) setPausaMaxMin(parsed.pausaMaxMin);
        if (parsed.variacaoTextoAtiva !== undefined) setVariacaoTextoAtiva(parsed.variacaoTextoAtiva);
        if (parsed.modoEnvioSemRestricao !== undefined) setModoEnvioSemRestricao(parsed.modoEnvioSemRestricao);
        if (parsed.horarioInicio !== undefined) setHorarioInicio(parsed.horarioInicio);
        if (parsed.horarioFim !== undefined) setHorarioFim(parsed.horarioFim);
      } catch (e) {
        console.error("Erro ao carregar configurações avançadas:", e);
      }
    }
  }, []);

  // Persistir configurações no localStorage
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        intervaloMin,
        intervaloMax,
        pausarAposEnvios,
        pausaMinMin,
        pausaMaxMin,
        variacaoTextoAtiva,
        modoEnvioSemRestricao,
        horarioInicio,
        horarioFim,
      })
    );
  }, [
    intervaloMin,
    intervaloMax,
    pausarAposEnvios,
    pausaMinMin,
    pausaMaxMin,
    variacaoTextoAtiva,
    modoEnvioSemRestricao,
    horarioInicio,
    horarioFim,
  ]);

  // Função para verificar se está dentro do horário permitido
  const isHorarioPermitido = (): boolean => {
    if (modoEnvioSemRestricao) return true;
    const hora = new Date().getHours();
    return hora >= horarioInicio && hora < horarioFim;
  };

  // Função para validar limites de envio (precisa receber os contadores de sessão/diário)
  const validarLimitesEnvio = (
    enviosSessao: number,
    enviosDiarios: number
  ): { permitido: boolean; motivo?: string } => {
    // Valida horário (se restrição estiver ativa)
    if (!modoEnvioSemRestricao) {
      const hora = new Date().getHours();
      if (hora < horarioInicio || hora >= horarioFim) {
        return {
          permitido: false,
          motivo: `Envio permitido apenas entre ${horarioInicio}h e ${horarioFim}h`,
        };
      }
    }

    if (enviosSessao >= LIMITE_SESSAO) {
      return {
        permitido: false,
        motivo: `Limite de ${LIMITE_SESSAO} mensagens por sessão atingido`,
      };
    }

    if (enviosDiarios >= LIMITE_DIARIO) {
      return {
        permitido: false,
        motivo: `Limite diário de ${LIMITE_DIARIO} mensagens atingido`,
      };
    }

    return { permitido: true };
  };

  // Função para gerar delay aleatório dentro do intervalo configurado
  const gerarDelayAleatorio = (): number => {
    return Math.floor(Math.random() * (intervaloMax - intervaloMin + 1)) + intervaloMin;
  };

  // Função para gerar pausa aleatória dentro do intervalo configurado
  const gerarPausaAleatoria = (): number => {
    const pausaSegundos =
      Math.floor(Math.random() * (pausaMaxMin - pausaMinMin + 1) + pausaMinMin) * 60;
    return pausaSegundos;
  };

  // Função para resetar configurações para o padrão
  const resetarConfiguracoes = () => {
    setIntervaloMin(CONFIG_PADRAO.intervaloMin);
    setIntervaloMax(CONFIG_PADRAO.intervaloMax);
    setPausarAposEnvios(CONFIG_PADRAO.pausarAposEnvios);
    setPausaMinMin(CONFIG_PADRAO.pausaMinMin);
    setPausaMaxMin(CONFIG_PADRAO.pausaMaxMin);
    setVariacaoTextoAtiva(CONFIG_PADRAO.variacaoTextoAtiva);
    setModoEnvioSemRestricao(CONFIG_PADRAO.modoEnvioSemRestricao);
    setHorarioInicio(CONFIG_PADRAO.horarioInicio);
    setHorarioFim(CONFIG_PADRAO.horarioFim);
  };

  return {
    // Estados de configuração
    intervaloMin,
    setIntervaloMin,
    intervaloMax,
    setIntervaloMax,
    pausarAposEnvios,
    setPausarAposEnvios,
    pausaMinMin,
    setPausaMinMin,
    pausaMaxMin,
    setPausaMaxMin,
    variacaoTextoAtiva,
    setVariacaoTextoAtiva,
    modoEnvioSemRestricao,
    setModoEnvioSemRestricao,
    horarioInicio,
    setHorarioInicio,
    horarioFim,
    setHorarioFim,

    // Funções utilitárias
    isHorarioPermitido,
    validarLimitesEnvio,
    gerarDelayAleatorio,
    gerarPausaAleatoria,
    resetarConfiguracoes,

    // Constantes exportadas
    LIMITE_SESSAO,
    LIMITE_DIARIO,
    CONFIG_PADRAO,
  };
}
