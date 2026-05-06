import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Info,
  ChevronDown,
  ChevronUp,
  MapPin,
  Stethoscope,
  Shield,
  FlaskConical,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCAL_BADGE_SOFT_CLASSES, LOCAL_SHORT_LABELS } from "@/lib/localAtendimento";
import {
  ORIGEM_LABELS,
  ORIGEM_BADGE_SOFT_CLASSES,
  ORIGEM_FILTER_OPTIONS,
} from "@/lib/origemLead";

const unidades = [
  {
    key: "clinicor" as const,
    desc: "Atendimento preferencial pela manhã",
  },
  {
    key: "hgp" as const,
    desc: "Atendimento preferencial à tarde",
  },
  {
    key: "belem" as const,
    desc: "Encaminhamento para clínicas parceiras (IOB / Vitria)",
  },
];

const tipos = [
  { label: "Consulta", desc: "Primeira consulta oftalmológica" },
  { label: "Retorno", desc: "Reavaliação de paciente já atendido" },
  { label: "Exame", desc: "Visual, OCT, mapeamento, etc." },
  { label: "Cirurgia", desc: "Catarata, pterígio, refrativa, etc." },
];

const convenios = [
  { label: "Particular", desc: "Pagamento direto" },
  { label: "Bradesco", desc: "Convênio aceito" },
  { label: "Unimed", desc: "Convênio aceito" },
  { label: "Cassi", desc: "Convênio aceito" },
  { label: "Sul América", desc: "Convênio aceito" },
  { label: "Outro", desc: "Convênio descrito manualmente" },
];

const indicadores: { icon: React.ReactNode; label: string; desc: string }[] = [
  {
    icon: <span className="inline-block h-3 w-1 rounded-sm bg-emerald-500" />,
    label: "Borda verde",
    desc: "Recente, ≤ 2 dias na fase",
  },
  {
    icon: <span className="inline-block h-3 w-1 rounded-sm bg-yellow-500" />,
    label: "Borda amarela",
    desc: "Atenção: parado há mais de 2 dias",
  },
  {
    icon: <span className="inline-block h-3 w-1 rounded-sm bg-red-500" />,
    label: "Borda vermelha",
    desc: "Urgente: parado há mais de 7 dias",
  },
  {
    icon: <Timer className="h-3 w-3 text-emerald-500" />,
    label: "Timer Nd",
    desc: "Dias desde a criação do lead",
  },
  {
    icon: <FlaskConical className="h-3 w-3 text-orange-500" />,
    label: "Selo TESTE",
    desc: "Sandbox — fora das métricas reais",
  },
];

const Section = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
      {icon}
      {title}
    </div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const Item = ({ badge, desc }: { badge: React.ReactNode; desc: string }) => (
  <div className="flex items-start gap-2 text-[12px] leading-snug">
    <div className="shrink-0 pt-0.5">{badge}</div>
    <span className="text-muted-foreground">{desc}</span>
  </div>
);

const CRMLegenda = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="w-full justify-between h-auto px-4 py-2.5 hover:bg-muted/40 rounded-xl"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Info className="h-4 w-4 text-primary" />
          Legenda dos cards
          <span className="text-[12px] font-normal text-muted-foreground hidden sm:inline">
            — entenda o que cada badge e cor significa
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {open && (
        <div className="px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 border-t border-border/60">
          <Section
            icon={<MapPin className="h-3.5 w-3.5 text-primary" />}
            title="Unidade de atendimento"
          >
            {unidades.map((u) => (
              <Item
                key={u.label}
                badge={
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0 border",
                      u.cls
                    )}
                  >
                    <MapPin className="h-2.5 w-2.5 mr-1" />
                    {u.label}
                  </Badge>
                }
                desc={u.desc}
              />
            ))}
          </Section>

          <Section
            icon={<Stethoscope className="h-3.5 w-3.5 text-primary" />}
            title="Tipo de atendimento"
          >
            {tipos.map((t) => (
              <Item
                key={t.label}
                badge={
                  <Badge
                    variant="outline"
                    className="text-[10px] font-medium px-1.5 py-0 bg-muted/50 text-muted-foreground border-border/60"
                  >
                    {t.label}
                  </Badge>
                }
                desc={t.desc}
              />
            ))}
          </Section>

          <Section
            icon={<Shield className="h-3.5 w-3.5 text-primary" />}
            title="Convênio"
          >
            {convenios.map((c) => (
              <Item
                key={c.label}
                badge={
                  <Badge
                    variant="outline"
                    className="text-[10px] font-medium px-1.5 py-0 bg-muted/50 text-muted-foreground border-border/60"
                  >
                    {c.label}
                  </Badge>
                }
                desc={c.desc}
              />
            ))}
          </Section>

          <Section
            icon={<Info className="h-3.5 w-3.5 text-primary" />}
            title="Urgência e indicadores"
          >
            {indicadores.map((i) => (
              <Item
                key={i.label}
                badge={i.icon}
                desc={`${i.label}: ${i.desc}`}
              />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
};

export default CRMLegenda;
