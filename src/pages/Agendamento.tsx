import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Heart, Shield, MapPin, Star, Phone, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const WHATSAPP_NUMBER = "5591936180476";
const TIPOS = ["Consulta", "Retorno", "Exame", "Cirurgia"] as const;

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const Agendamento = () => {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [errors, setErrors] = useState<{ nome?: string; telefone?: string; tipo?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_type: "landing_agendamento",
      page_path: "/agendamento",
    });
    if (typeof window.fbq === "function") {
      window.fbq("track", "ViewContent", {
        content_name: "Landing Agendamento",
        content_category: "Oftalmologia",
      });
    }
  }, []);

  const validate = () => {
    const next: typeof errors = {};
    if (nome.trim().length < 3) next.nome = "Informe seu nome completo (mín. 3 caracteres).";
    const digits = telefone.replace(/\D/g, "");
    if (digits.length < 10) next.telefone = "Informe um WhatsApp válido com DDD.";
    if (!tipo) next.tipo = "Selecione o tipo de atendimento.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);

    const phoneDigits = telefone.replace(/\D/g, "");
    const nomeTrim = nome.trim();

    try {
      const { error } = await supabase.functions.invoke("criar-lead", {
        body: {
          nome_completo: nomeTrim,
          telefone_whatsapp: phoneDigits,
          tipo_atendimento: tipo,
          origem: "landing_agendamento",
          local_atendimento: "A definir",
          convenio: "A definir",
        },
      });

      if (error) {
        console.error("[Agendamento] Erro ao criar lead:", error);
        toast({
          title: "Não foi possível registrar agora",
          description: "Vamos te redirecionar para o WhatsApp mesmo assim.",
          variant: "destructive",
        });
      }

      // Tracking events
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "generate_lead",
        event_category: "agendamento",
        event_label: tipo,
        page_type: "landing_agendamento",
        value: 300,
        currency: "BRL",
      });

      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead", {
          content_name: "Agendamento Landing",
          content_category: tipo,
          value: 300,
          currency: "BRL",
        });
        window.fbq("track", "SubmitApplication");
      }

      const message = `Olá! Sou ${nomeTrim}, gostaria de agendar uma ${tipo}.`;
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      window.location.href = url;
    } catch (err) {
      console.error("[Agendamento] Erro inesperado:", err);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Agende sua Consulta · Dr. Juliano Machado — Oftalmologista em Paragominas</title>
        <meta
          name="description"
          content="Agende sua consulta oftalmológica em Paragominas com o Dr. Juliano Machado. Atendimento humanizado, convênios aceitos. Resposta rápida via WhatsApp."
        />
        <link rel="canonical" href="https://drjulianomachado.com/agendamento" />
      </Helmet>

      {/* Header minimal */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-serif text-base sm:text-lg font-bold gradient-text leading-tight">
              Dr. Juliano Machado
            </span>
            <span className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
              Oftalmologista · Paragominas
            </span>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#25D366] hover:text-[#20BD5A] transition-colors"
            aria-label="Falar no WhatsApp"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
      </header>

      {/* Hero + Form */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-gradient opacity-60" aria-hidden />
        <div className="absolute inset-0 noise-overlay" aria-hidden />

        <div className="container mx-auto px-4 py-10 sm:py-16 relative">
          <div className="max-w-xl mx-auto text-center mb-8 animate-fade-in">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold tracking-wide uppercase mb-4">
              Agendamento Online
            </span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold mb-3 leading-tight">
              Agende sua <span className="gradient-text">Consulta</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Oftalmologia em Paragominas — Dr. Juliano Machado
            </p>
            <div className="flex items-center justify-center gap-1 mt-3 text-sm text-muted-foreground">
              <Star className="w-4 h-4 fill-primary text-primary" />
              <Star className="w-4 h-4 fill-primary text-primary" />
              <Star className="w-4 h-4 fill-primary text-primary" />
              <Star className="w-4 h-4 fill-primary text-primary" />
              <Star className="w-4 h-4 fill-primary text-primary" />
              <span className="ml-2">+6.000 pacientes atendidos</span>
            </div>
          </div>

          <Card className="max-w-xl mx-auto card-premium border-primary/20 shadow-2xl animate-fade-in">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-sm font-medium">
                    Nome completo *
                  </Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    autoComplete="name"
                    className="h-12 text-base focus-visible:ring-primary"
                    aria-invalid={!!errors.nome}
                    aria-describedby={errors.nome ? "nome-error" : undefined}
                  />
                  {errors.nome && (
                    <p id="nome-error" className="text-xs text-destructive">
                      {errors.nome}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone" className="text-sm font-medium">
                    WhatsApp *
                  </Label>
                  <Input
                    id="telefone"
                    type="tel"
                    inputMode="tel"
                    placeholder="(91) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(formatPhone(e.target.value))}
                    autoComplete="tel-national"
                    className="h-12 text-base focus-visible:ring-primary"
                    aria-invalid={!!errors.telefone}
                    aria-describedby={errors.telefone ? "tel-error" : undefined}
                  />
                  {errors.telefone && (
                    <p id="tel-error" className="text-xs text-destructive">
                      {errors.telefone}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo" className="text-sm font-medium">
                    Tipo de atendimento *
                  </Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger
                      id="tipo"
                      className="h-12 text-base focus:ring-primary"
                      aria-invalid={!!errors.tipo}
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tipo && <p className="text-xs text-destructive">{errors.tipo}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-14 text-base font-bold bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-lg shadow-[#25D366]/30 hover:shadow-xl hover:shadow-[#25D366]/40 transition-all hover:scale-[1.02] active:scale-100"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-5 h-5" />
                      Agendar via WhatsApp
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Resposta rápida pelo WhatsApp em horário comercial
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust cards */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {[
            {
              icon: Heart,
              title: "Atendimento Humanizado",
              desc: "Cuidado individual e atenção em cada consulta com escuta ativa.",
            },
            {
              icon: Shield,
              title: "Convênios Aceitos",
              desc: "Bradesco, Unimed, Cassi, Sul América e particular.",
            },
            {
              icon: MapPin,
              title: "Localização Paragominas",
              desc: "Clinicor, Hospital Geral e atendimento também em Belém.",
            },
          ].map((item) => (
            <Card key={item.title} className="card-glass border-primary/20 hover:border-primary/40 transition-all">
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials placeholder */}
      <section className="bg-secondary/20 py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-center mb-8">
            O que dizem nossos pacientes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              { name: "Maria S.", text: "Atendimento excelente, médico atencioso e dedicado. Recomendo!" },
              { name: "João P.", text: "Consulta tranquila, explicações claras e resultado rápido." },
              { name: "Ana L.", text: "Profissional muito qualificado. Saí da consulta confiante." },
            ].map((t) => (
              <Card key={t.name} className="card-premium">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground/90 italic mb-4 leading-relaxed">"{t.text}"</p>
                  <p className="text-xs font-semibold text-muted-foreground">— {t.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="font-serif font-semibold gradient-text">Dr. Juliano Machado</p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Phone className="w-4 h-4" />
            <a href={`tel:+${WHATSAPP_NUMBER}`} className="hover:text-primary transition-colors">
              (91) 93618-0476
            </a>
          </p>
          <p className="text-xs text-muted-foreground">
            Clinicor · Av. Pres. Vargas, 1234 — Paragominas/PA
          </p>
          <p className="text-xs text-muted-foreground/70 pt-2">
            © {new Date().getFullYear()} Dr. Juliano Machado · Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Agendamento;
