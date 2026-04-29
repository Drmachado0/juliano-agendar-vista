import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class AdminErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[AdminErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h3 className="font-semibold">
              {this.props.fallbackTitle || "Não foi possível carregar esta seção"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Ocorreu um erro ao renderizar este conteúdo. Tente recarregar — se
              o problema persistir, verifique os logs do sistema.
            </p>
            {this.state.error?.message && (
              <code className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded max-w-full overflow-auto">
                {this.state.error.message}
              </code>
            )}
            <Button size="sm" variant="outline" onClick={this.handleReset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
