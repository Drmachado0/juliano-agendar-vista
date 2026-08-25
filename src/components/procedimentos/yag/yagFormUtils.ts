/**
 * Máscaras e validações do formulário de YAG Laser.
 *
 * A lógica de data espelha a que existe inline em
 * `src/components/scheduling/PersonalDataStep.tsx` (mesmo comportamento de
 * máscara DD/MM/AAAA, mesma rejeição de data inválida/futura). Foi extraída
 * para cá em vez de refatorar o PersonalDataStep porque aquele componente
 * serve o funil de agendamento em produção e não faz parte deste escopo.
 *
 * A validação de telefone NÃO é duplicada: reutiliza `validarTelefoneBrasileiro`,
 * que já é o utilitário compartilhado do projeto.
 */
import { validarTelefoneBrasileiro } from "@/lib/validarTelefoneBR";

export type OlhoOperado = "Direito" | "Esquerdo" | "Ambos";

export const OLHOS: OlhoOperado[] = ["Direito", "Esquerdo", "Ambos"];

/** Aplica máscara DD/MM/AAAA enquanto o usuário digita. */
export function mascararData(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Aplica máscara (XX) XXXXX-XXXX enquanto o usuário digita. */
export function mascararTelefone(value: string): string {
  const n = value.replace(/\D/g, "").slice(0, 11);
  if (n.length === 0) return "";
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
}

/**
 * Converte DD/MM/AAAA para AAAA-MM-DD.
 * Retorna "" se a data for incompleta ou não existir no calendário
 * (ex.: 31/02/2020).
 */
export function dataBrParaIso(br: string): string {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) {
    return "";
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export interface YagFormValues {
  nome: string;
  dataNascimento: string; // DD/MM/AAAA
  telefone: string; // mascarado
  olho: OlhoOperado | "";
  convenio: string; // opcional
}

export type YagFormErrors = Partial<Record<keyof YagFormValues, string>>;

/** Ordem visual dos campos — usada para focar o primeiro inválido. */
export const ORDEM_CAMPOS: (keyof YagFormValues)[] = [
  "nome",
  "dataNascimento",
  "telefone",
  "olho",
];

export function validarFormulario(values: YagFormValues): YagFormErrors {
  const errors: YagFormErrors = {};

  const nome = values.nome.trim();
  if (!nome) {
    errors.nome = "Por favor, informe seu nome completo.";
  } else if (nome.split(/\s+/).filter(Boolean).length < 2) {
    errors.nome = "Informe nome e sobrenome.";
  } else if (!/^[A-Za-zÀ-ÿ\s'-]+$/.test(nome)) {
    errors.nome = "O nome deve conter apenas letras e espaços.";
  }

  const bd = values.dataNascimento.trim();
  if (!bd) {
    errors.dataNascimento = "Informe a data de nascimento.";
  } else if (bd.length !== 10 || !dataBrParaIso(bd)) {
    errors.dataNascimento = "Digite uma data válida no formato DD/MM/AAAA.";
  } else {
    const iso = dataBrParaIso(bd);
    const [ano, mes, dia] = iso.split("-").map(Number);
    const nascimento = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (ano < 1900) {
      errors.dataNascimento = "Digite uma data válida no formato DD/MM/AAAA.";
    } else if (nascimento > hoje) {
      errors.dataNascimento = "A data de nascimento não pode estar no futuro.";
    }
  }

  if (!values.telefone.trim()) {
    errors.telefone = "Informe seu WhatsApp para entrarmos em contato.";
  } else {
    const check = validarTelefoneBrasileiro(values.telefone);
    if (!check.valido) {
      errors.telefone = check.erro ?? "Digite um número válido com DDD.";
    }
  }

  if (!values.olho) {
    errors.olho = "Selecione qual olho foi operado.";
  }

  return errors;
}

/**
 * Texto gravado em `detalhe_exame_ou_cirurgia`. Já aparece hoje no card do
 * Kanban e no modal de detalhes do admin, sem precisar de coluna nova.
 */
export function montarDetalhe(olho: OlhoOperado | ""): string {
  return `Capsulotomia YAG Laser — Olho: ${olho || "não informado"}`;
}

/**
 * Remove valores embutidos no nome do convênio.
 *
 * Alguns registros da tabela `convenios` têm o preço no próprio nome
 * (ex.: "Particular - R$: 300,00"). Esta página não informa valores — eles
 * são passados pela equipe no contato, e a cobrança é por olho tratado.
 * A limpeza é feita na exibição E no valor gravado, para não registrar no
 * CRM um preço que está incorreto.
 *
 * Correção definitiva: renomear o registro em /admin/configuracoes, o que
 * também conserta o funil de agendamento principal.
 */
/**
 * Valor gravado em `agendamentos.convenio`.
 *
 * O particular do YAG é cobrado por olho e ainda será definido — é diferente
 * do particular da consulta, que segue com o próprio valor cadastrado. Por
 * isso o lead de YAG grava "Particular (YAG)": o paciente continua vendo
 * apenas "Particular", mas no CRM os dois nunca se confundem.
 *
 * Feito aqui em vez de criar um registro novo na tabela `convenios` porque
 * aquela lista é compartilhada — um registro novo apareceria também no
 * dropdown de quem marca consulta comum em /agendamento.
 */
export function valorConvenioCrm(rotulo: string): string {
  return /^particular$/i.test(rotulo.trim()) ? "Particular (YAG)" : rotulo;
}

export function limparRotuloConvenio(nome: string): string {
  return (nome || "")
    // "- R$: 300,00", "– R$ 300", "— RS 300.00", com ou sem separador antes.
    // [$S] cobre o erro de digitação "RS" no lugar de "R$".
    .replace(/\s*[-–—:]*\s*R\s*[$S]?\s*:?\s*\d[\d.,]*/gi, "")
    // sobras de separador no fim ("Particular -", "Particular —")
    .replace(/[\s\-–—:]+$/, "")
    .trim();
}
