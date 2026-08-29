/**
 * Tipos para scripts/rotas-extra.mjs.
 *
 * POR QUE EXISTE: o src/test/rotasComHtml.test.ts importa aquele .mjs, e o
 * tsconfig.app.json nao liga allowJs nem noImplicitAny. Sem esta declaracao a
 * lista chega como any no teste, e um erro de tipo dentro do guarda de rotas
 * passaria despercebido justamente no arquivo que existe para nao deixar coisa
 * passar despercebida.
 */
export declare const ROTAS_EXTRA: readonly string[]
