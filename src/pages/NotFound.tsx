import { useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import { Home, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      {/* O hosting serve a SPA com HTTP 200 para qualquer rota, entao nao ha 404
          real. Sem noindex, qualquer URL inexistente vira pagina indexavel. */}
      <Helmet>
        <title>Página não encontrada | Dr. Juliano Machado</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>

    <div className="flex min-h-screen items-center justify-center bg-background hero-gradient noise-overlay px-4">
      <div className="text-center max-w-md">
        <h1 className="mb-3 text-7xl font-extrabold gradient-text tracking-tight">404</h1>
        <p className="mb-2 text-2xl font-semibold text-foreground">Página não encontrada</p>
        <p className="mb-8 text-sm text-muted-foreground">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
              <Home className="h-4 w-4" />
              Voltar ao início
            </Button>
          </Link>
          <Link to="/agendamento">
            <Button variant="hero" size="lg" className="w-full sm:w-auto gap-2">
              <CalendarCheck className="h-4 w-4" />
              Agendar consulta
            </Button>
          </Link>
        </div>
      </div>
    </div>
    </>
  );
};

export default NotFound;
