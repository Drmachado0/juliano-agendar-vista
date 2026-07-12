import { Button } from "@/components/ui/button";
import { FormData } from "./SchedulingModal";
import {
  User,
  Phone,
  Calendar,
  Mail,
  Stethoscope,
  MapPin,
  Shield,
  Clock,
  Check,
  X,
  Loader2,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ParagominasConfirmationStepProps {
  formData: FormData;
  onSubmit: () => void;
  onPrev: () => void;
  onEditStep?: (step: number) => void;
  isSubmitting?: boolean;
}

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  exame: "Exame",
  cirurgia: "Cirurgia",
};

const LOCATION_LABELS: Record<string, string> = {
  clinicor: "Clinicor – Paragominas",
  hgp: "Hospital Geral de Paragominas",
  belem: "Belém (IOB / Vitria)",
};

const INSURANCE_LABELS: Record<string, string> = {
  particular: "Particular",
  bradesco: "Bradesco",
  unimed: "Unimed",
  cassi: "Cassi",
  sulamerica: "Sul América",
};

// ISO (yyyy-mm-dd) → dd/mm/aaaa. Aceita já formatado ou vazio.
const formatBirthDate = (value?: string) => {
  if (!value) return "Não informado";
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return value;
};

// Telefone BR (apenas render). Ex.: 5591991150174 / 91991150174 / 91 99115-0174
const formatPhoneBR = (value?: string) => {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
};

const safe = (v?: string) => (v && v.trim() ? v : "Não informado");

const ParagominasConfirmationStep = ({
  formData,
  onSubmit,
  onPrev,
  onEditStep,
  isSubmitting = false,
}: ParagominasConfirmationStepProps) => {
  const tipoAtendimento =
    formData.appointmentTypeName ||
    APPOINTMENT_TYPE_LABELS[formData.appointmentType] ||
    formData.appointmentType ||
    "—";

  const local =
    formData.locationName ||
    LOCATION_LABELS[formData.location] ||
    formData.location ||
    "—";

  const convenio =
    formData.insurance === "outro"
      ? formData.otherInsurance || "Outro"
      : formData.insuranceName ||
        INSURANCE_LABELS[formData.insurance] ||
        formData.insurance ||
        "—";

  const dataConsulta = formData.selectedDate
    ? format(formData.selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "—";

  const Section = ({
    id,
    title,
    stepIndex,
    children,
  }: {
    id: string;
    title: string;
    stepIndex?: number;
    children: React.ReactNode;
  }) => (
    <section
      aria-labelledby={id}
      className="pgm-summary-section"
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          id={id}
          className="text-[13px] uppercase tracking-[0.18em] font-semibold"
          style={{ color: "var(--pgm-petroleo)" }}
        >
          {title}
        </h3>
        {onEditStep && stepIndex && (
          <button
            type="button"
            onClick={() => onEditStep(stepIndex)}
            className="inline-flex items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
            style={{ color: "var(--pgm-petroleo)" }}
            aria-label={`Editar ${title}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Editar
          </button>
        )}
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {children}
      </dl>
    </section>
  );

  const Item = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: typeof User;
    label: string;
    value: string;
  }) => (
    <div className="flex items-start gap-3 min-w-0">
      <span
        aria-hidden
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "#E6F2EF", color: "#0F6B6B" }}
      >
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <dt
          className="text-[12px] uppercase tracking-[0.14em] font-medium"
          style={{ color: "#5C625F" }}
        >
          {label}
        </dt>
        <dd
          className="mt-1 text-[15px] md:text-[16px] leading-snug break-words"
          style={{ color: "#082E33", fontWeight: 650 }}
        >
          {value}
        </dd>
      </div>
    </div>
  );

  const Pref = ({ label, active }: { label: string; active: boolean }) => (
    <li className="flex items-center gap-3 text-[15px]">
      <span
        aria-hidden
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: active ? "#E6F2EF" : "#EDE9DF",
          color: active ? "#0F6B6B" : "#5C625F",
        }}
      >
        {active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      </span>
      <span style={{ color: "#082E33" }}>
        {label}: <strong style={{ fontWeight: 650 }}>{active ? "Sim" : "Não"}</strong>
      </span>
    </li>
  );

  return (
    <div className="space-y-6" data-testid="pgm-confirmation">
      <header className="space-y-1.5">
        <h2 className="pgm-serif text-2xl md:text-3xl leading-tight" style={{ color: "#082E33" }}>
          Revise e confirme seu agendamento
        </h2>
        <p className="text-[14px] md:text-[15px]" style={{ color: "#5C625F" }}>
          Confira se os dados estão corretos antes de confirmar.
        </p>
      </header>

      <div
        className="pgm-summary-card rounded-xl md:rounded-2xl overflow-hidden"
        style={{
          background: "#FAF8F2",
          border: "1px solid #D8D1C2",
        }}
      >
        {/* Filete champagne premium no topo */}
        <div aria-hidden style={{ height: 3, background: "#C8AA72" }} />

        <div className="p-4 md:p-6 space-y-6">
          <Section id="pgm-sec-dados" title="Seus dados" stepIndex={1}>
            <Item icon={User} label="Nome" value={safe(formData.fullName)} />
            <Item icon={Phone} label="Telefone" value={formatPhoneBR(formData.phone)} />
            <Item icon={Calendar} label="Nascimento" value={formatBirthDate(formData.birthDate)} />
            <Item icon={Mail} label="E-mail" value={safe(formData.email)} />
          </Section>

          <div style={{ height: 1, background: "#DDD7CB" }} aria-hidden />

          <Section id="pgm-sec-atend" title="Atendimento" stepIndex={2}>
            <Item icon={Stethoscope} label="Tipo" value={tipoAtendimento} />
            <Item icon={MapPin} label="Local" value={local} />
            <Item icon={Shield} label="Convênio" value={convenio} />
          </Section>

          <div style={{ height: 1, background: "#DDD7CB" }} aria-hidden />

          <Section id="pgm-sec-data" title="Data e horário" stepIndex={3}>
            <Item icon={Calendar} label="Data" value={dataConsulta} />
            <Item icon={Clock} label="Horário" value={safe(formData.selectedTime)} />
          </Section>

          <div style={{ height: 1, background: "#DDD7CB" }} aria-hidden />

          <section aria-labelledby="pgm-sec-prefs">
            <div className="flex items-center justify-between mb-3">
              <h3
                id="pgm-sec-prefs"
                className="text-[13px] uppercase tracking-[0.18em] font-semibold"
                style={{ color: "var(--pgm-petroleo)" }}
              >
                Preferências
              </h3>
              {onEditStep && (
                <button
                  type="button"
                  onClick={() => onEditStep(3)}
                  className="inline-flex items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline rounded"
                  style={{ color: "var(--pgm-petroleo)" }}
                  aria-label="Editar preferências"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Editar
                </button>
              )}
            </div>
            <ul className="space-y-2.5">
              <Pref label="Primeiro horário disponível" active={!!formData.acceptFirstAvailable} />
              <Pref label="Lembretes pelo WhatsApp" active={!!formData.acceptNotifications} />
            </ul>
          </section>
        </div>
      </div>

      {/* Botões */}
      <div className="flex flex-col-reverse md:flex-row md:justify-between gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onPrev}
          className="w-full md:w-auto min-h-[52px] rounded-xl"
          disabled={isSubmitting}
        >
          Voltar
        </Button>
        <Button
          variant="hero"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full md:w-auto min-h-[56px] rounded-xl"
          aria-live="polite"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
          {isSubmitting ? "Confirmando..." : "Confirmar agendamento"}
        </Button>
      </div>

      {/* padding bottom pra não colidir com sticky/WhatsApp no mobile */}
      <div aria-hidden className="h-4 md:h-0" />
    </div>
  );
};

export default ParagominasConfirmationStep;
