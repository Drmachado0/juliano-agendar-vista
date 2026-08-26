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
        //   @supabase/supabase-js -> AuthContext (raiz) e WhatsAppButton (home)
        //   @tanstack/react-query -> QueryClientProvider (raiz)
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
}));

