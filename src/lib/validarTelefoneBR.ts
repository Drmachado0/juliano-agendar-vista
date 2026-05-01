// ===== VALIDAÇÃO DE TELEFONE BRASILEIRO =====
// Compartilhado entre /admin/avaliacoes e /admin/lembretes (e outros disparos em lote).

export const dddsValidos = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
  21, 22, 24, // RJ
  27, 28, // ES
  31, 32, 33, 34, 35, 37, 38, // MG
  41, 42, 43, 44, 45, 46, // PR
  47, 48, 49, // SC
  51, 53, 54, 55, // RS
  61, // DF
  62, 64, // GO
  63, // TO
  65, 66, // MT
  67, // MS
  68, // AC
  69, // RO
  71, 73, 74, 75, 77, // BA
  79, // SE
  81, 82, 83, 84, 85, 86, 87, 88, 89, // NE
  91, 92, 93, 94, 95, 96, 97, 98, 99 // Norte
];

export interface ValidacaoTelefone {
  valido: boolean;
  erro?: string;
  podeCorrigir?: boolean;
}

// Autocorrige telefone (adiciona 9 após DDD se faltando)
export function autocorrigirTelefone(
  telefone: string
): { corrigido: string; foiCorrigido: boolean; formatado: string } {
  let numeros = telefone.replace(/\D/g, '');
  let foiCorrigido = false;

  if (numeros.startsWith('55') && numeros.length >= 12) {
    numeros = numeros.slice(2);
  }

  if (numeros.length === 10) {
    const ddd = numeros.slice(0, 2);
    const numero = numeros.slice(2);
    numeros = ddd + '9' + numero;
    foiCorrigido = true;
  }

  let formatado = numeros;
  if (numeros.length === 11) {
    formatado = `+55 (${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  } else if (numeros.length === 10) {
    formatado = `+55 (${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }

  return { corrigido: numeros, foiCorrigido, formatado };
}

export function validarTelefoneBrasileiro(telefone: string): ValidacaoTelefone {
  let numeros = telefone.replace(/\D/g, '');

  if (numeros.startsWith('55') && numeros.length >= 12) {
    numeros = numeros.slice(2);
  }

  if (numeros.length === 10) {
    const ddd = parseInt(numeros.slice(0, 2));
    if (dddsValidos.includes(ddd)) {
      return {
        valido: false,
        erro: 'Falta o dígito 9 após o DDD. Clique para corrigir.',
        podeCorrigir: true,
      };
    }
  }

  if (numeros.length < 10 || numeros.length > 11) {
    return {
      valido: false,
      erro: `Telefone deve ter 10 ou 11 dígitos. Atual: ${numeros.length} dígitos.`,
    };
  }

  const ddd = parseInt(numeros.slice(0, 2));
  if (!dddsValidos.includes(ddd)) {
    return { valido: false, erro: `DDD ${ddd} não é válido.` };
  }

  if (numeros.length === 11) {
    const primeiroDigitoNumero = numeros[2];
    if (primeiroDigitoNumero !== '9') {
      return { valido: false, erro: 'Celular deve começar com 9 após o DDD.' };
    }
  }

  return { valido: true };
}
