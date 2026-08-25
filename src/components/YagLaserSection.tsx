import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  Eye,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import {
  VALOR_YAG,
  VALOR_YAG_UNIDADE,
  WHATSAPP_MENSAGEM,
  WHATSAPP_ORIGEM,
} from "@/components/procedimentos/yag/yagContent";

const DESTAQUES = [
  { icone: Clock, texto: "Poucos minutos, sem internação" },
  { icone: Eye, texto: "Colírio anestésico — sem cortes nem agulhas" },
  { icone: ShieldCheck, texto: "Alta no mesmo dia" },
];

/**
 * Seção de YAG Laser na home.
 *
 * Existe porque o procedimento mudou de cidade e passou a ter valor definido —
 * dois fatos que o card genérico de ProceduresSection não comunica. O valor é
 * informativo, nunca apresentado como promoção ou comparação (Manual de
 * Publicidade Médica do CFM).
 *
 * Fonte do preço: VALOR_YAG em yagContent.ts. Não escreva o número aqui.
 */
const YagLaserSection = () => {
  const { waLink } = useSiteWhatsApp();

  return (
    <section
      id="yag-laser"
      aria-labelledby="yag-home-titulo"
      className="py-16 md:py-24 scroll-mt-24"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto card-glass rounded-3xl p-6 md:p-10 border border-primary/15">
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-10 items-center">
            {/* Conteúdo */}
            <div className="lg:col-span-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold text-sm mb-5">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                Agora em Paragominas — HGP
              </span>

              <h2
                id="yag-home-titulo"
                className="text-2xl md:text-4xl font-bold text-foreground mb-4 leading-tight"
              >
                Sua visão voltou a embaçar depois da cirurgia de catarata?
              </h2>

              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Não é a catarata voltando. É a cápsula que sustenta a lente que
                pode ficar opaca com o tempo — e o{" "}
                <strong className="text-foreground">YAG Laser</strong> resolve
                isso abrindo uma pequena janela nela, sem cirurgia. O
                procedimento é realizado no{" "}
                <strong className="text-foreground">
                  Hospital Geral de Paragominas
                </strong>
                .
              </p>

              <ul className="space-y-3 mb-8">
                {DESTAQUES.map(({ icone: Icone, texto }) => (
                  <li
                    key={texto}
                    className="flex items-center gap-3 text-base md:text-lg text-muted-foreground"
                  >
                    <Icone
                      className="w-5 h-5 text-primary shrink-0"
                      aria-hidden="true"
                    />
                    {texto}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/procedimentos/capsulotomia-yag-laser">
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full sm:w-auto gap-2 min-h-14 text-base"
                  >
                    Entenda e agende
                    <ArrowRight className="w-5 h-5" aria-hidden="true" />
                  </Button>
                </Link>

                <a
                  href={waLink(WHATSAPP_MENSAGEM, `${WHATSAPP_ORIGEM}_home`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto min-h-14 px-6 rounded-xl border-2 border-[#25D366] text-[#25D366] text-base font-bold hover:bg-[#25D366] hover:text-white transition"
                >
                  <MessageCircle className="w-5 h-5" aria-hidden="true" />
                  Falar no WhatsApp
                </a>
              </div>
            </div>

            {/* Valor */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 md:p-7 text-center">
                <p className="inline-flex items-center gap-2 text-base text-muted-foreground mb-3">
                  <Wallet className="w-4 h-4 text-primary" aria-hidden="true" />
                  Particular
                </p>
                <p className="text-4xl md:text-5xl font-bold text-primary leading-none">
                  {VALOR_YAG}
                </p>
                <p className="text-lg text-foreground font-semibold mt-2">
                  {VALOR_YAG_UNIDADE} tratado
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-4 pt-4 border-t border-border/60">
                  Quem precisa tratar os dois olhos paga o valor de cada um
                  separadamente. Atendemos também por convênio — a cobertura
                  depende do seu plano e nossa equipe verifica antes de
                  confirmar a data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default YagLaserSection;
