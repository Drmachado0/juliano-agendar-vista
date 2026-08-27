import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: mode === "production"
    ? { pure: ["console.log", "console.info", "console.debug"] }
    : undefined,
  build: {
    // O chunk do cliente Supabase nao entra no preload da entry.
    //
    // POR QUE: com o AuthProvider restrito as rotas /admin e /auth, pagina
    // publica nunca chama getSupabase(), entao o chunk nunca EXECUTA la. Mas o
    // Vite continuava emitindo <link rel="modulepreload"> para ele no
    // index.html, e o navegador baixava 45,6 KB gzip que ninguem usaria — a
    // dica de preload virou a unica coisa segurando o chunk no caminho critico.
    //
    // Filtrar so a DICA e seguro: quem realmente precisa (admin e login)
    // carrega pelo import dinamico normalmente, so sem a antecipacao.
    modulePreload: {
      resolveDependencies: (_arquivo: string, deps: string[]) =>
        deps.filter((d) => !/client-[A-Za-z0-9_-]+\.js$/.test(d)),
    },
    rollupOptions: {
      output: {
        // Separa libs pesadas do chunk principal (era ~789 kB).
        // Só bibliotecas que as paginas PUBLICAS realmente carregam entram
        // aqui. manualChunks estatico promove o chunk a dependencia inicial da
        // entry, o que gera <link rel="modulepreload"> e fura o lazy() das
        // rotas. recharts ficava assim: usado so pelas 3 paginas /admin (todas
        // lazy), mas baixado em toda visita a home. Sem a entrada abaixo, o
        // Rollup o agrupa junto dos chunks assincronos do admin.
        //   react / react-router  -> raiz do App
          //
          // @supabase/supabase-js SAIU desta lista em 27/08/2026. Deixou de ser
          // dependencia da raiz: AuthContext, WhatsAppButton, os servicos e o
          // useGoogleReviews resolvem o cliente por import dinamico
          // (src/integrations/supabase/lazy.ts), e Auth e Obrigado viraram rotas
          // lazy.
          //
          // Tornar os imports dinamicos NAO bastou: enquanto o nome ficou aqui,
          // o modulepreload continuou sendo gerado e os 48 KB gzip seguiram no
          // caminho critico de toda rota. Mesmo efeito que o paragrafo acima
          // descreve para o recharts — a configuracao desfazia o trabalho do
          // codigo.
        //   @tanstack/react-query -> QueryClientProvider (raiz)
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
}));

