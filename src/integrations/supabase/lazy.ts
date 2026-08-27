/**
 * Acesso preguicoso ao cliente Supabase.
 *
 * POR QUE: importar "./client" no topo de um modulo que a raiz do app carrega
 * torna @supabase/supabase-js dependencia inicial da entry. O Vite entao gera
 * <link rel="modulepreload"> para o chunk, e ele entra no caminho critico de
 * TODA rota — inclusive paginas de texto puro como /procedimentos/glaucoma, que
 * so tocam o Supabase se o visitante interagir.
 *
 * Medido na auditoria: 48,2 KB gzip dentro de um caminho critico de 258,6 KB,
 * quase 19% dele. Os dois responsaveis eram AuthContext, que envolve o app
 * inteiro, e WhatsAppButton, presente em toda pagina.
 *
 * Nao adianta so remover o modulepreload: enquanto o import for estatico, os
 * mesmos bytes continuam necessarios, apenas descobertos mais tarde — seria
 * pessimizacao. O import precisa ser dinamico de verdade, e e isso que este
 * modulo oferece.
 *
 * A promessa e memorizada, entao o chunk baixa uma vez so por sessao, por mais
 * chamadores que existam.
 */
/**
 * Tipo por import DINAMICO, nao `import type` estatico.
 *
 * POR QUE: mesmo sendo apagado na transpilacao, o `import type { supabase }
 * from "./client"` bastou para o Rollup manter o client como dependencia da
 * entry, e o chunk de 45,6 KB continuou com modulepreload no index.html. Esta
 * forma nao deixa aresta nenhuma no grafo.
 */
type Cliente = (typeof import("./client"))["supabase"];

let promessa: Promise<Cliente> | null = null;

export function getSupabase(): Promise<Cliente> {
  promessa ??= import("./client").then((m) => m.supabase);
  return promessa;
}
