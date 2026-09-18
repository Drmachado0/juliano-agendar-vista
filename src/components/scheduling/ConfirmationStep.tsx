import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormData } from "./SchedulingModal";
import { User, Phone, Calendar, Mail, Stethoscope, MapPin, Shield, Clock, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

interface ConfirmationStepProps {
  formData: FormData;
  onSubmit: () => void;
  onPrev: () => void;
  isSubmitting?: boolean;
  collectDeferredPersonalDetails?: boolean;
  updateFormData?: (data: Partial<FormData>) => void;
}

const isoToBr = (iso: string) => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

const brToIso = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
};

const maskBirthDate = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const ConfirmationStep = ({
  formData,
  onSubmit,
  onPrev,
  isSubmitting = false,
  collectDeferredPersonalDetails = false,
  updateFormData,
}: ConfirmationStepProps) => {
  const [birthDateBr, setBirthDateBr] = useState(isoToBr(formData.birthDate));
  const [errors, setErrors] = useState<{ birthDate?: string; email?: string }>({});
  const getAppointmentTypeLabel = (value: string) => {
    const types: Record<string, string> = {
      consulta: "Consulta",
      retorno: "Retorno",
      exame: "Exame",
      cirurgia: "Cirurgia",
    };
    return types[value] || value;
  };

  const getLocationLabel = (value: string) => {
    const locations: Record<string, string> = {
      clinicor: "Clinicor – Paragominas",
      hgp: "Hospital Geral de Paragominas",
      belem: "Belém (IOB / Vitria)",
    };
    return locations[value] || value;
  };

  const getInsuranceLabel = (value: string) => {
    const insurances: Record<string, string> = {
      particular: "Particular",
      bradesco: "Bradesco",
      unimed: "Unimed",
      cassi: "Cassi",
      sulamerica: "Sul América",
      outro: formData.otherInsurance || "Outro",
    };
    return insurances[value] || value;
  };

  const summaryItems = [
    { icon: User, label: "Nome", value: formData.fullName },
    { icon: Phone, label: "Telefone", value: formData.phone },
    { icon: Calendar, label: "Nascimento", value: formData.birthDate || "Não informado" },
    { icon: Mail, label: "E-mail", value: formData.email || "Não informado" },
    { icon: Stethoscope, label: "Tipo", value: getAppointmentTypeLabel(formData.appointmentType) },
    { icon: MapPin, label: "Local", value: getLocationLabel(formData.location) },
    { icon: Shield, label: "Convênio", value: getInsuranceLabel(formData.insurance) },
    {
      icon: Calendar,
      label: "Data",
      value: formData.selectedDate
        ? format(formData.selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        : "",
    },
    { icon: Clock, label: "Horário", value: formData.selectedTime },
  ];

  const handleSubmit = () => {
    if (!collectDeferredPersonalDetails) {
      onSubmit();
      return;
    }

    const nextErrors: { birthDate?: string; email?: string } = {};
    const isoBirthDate = brToIso(birthDateBr);
    if (!birthDateBr) {
      nextErrors.birthDate = "Informe a data de nascimento.";
    } else if (!isoBirthDate) {
      nextErrors.birthDate = "Digite uma data válida no formato DD/MM/AAAA.";
    } else {
      const year = Number(isoBirthDate.slice(0, 4));
      const birthDate = new Date(`${isoBirthDate}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (year < 1900) nextErrors.birthDate = "Digite uma data válida no formato DD/MM/AAAA.";
      else if (birthDate > today) nextErrors.birthDate = "A data de nascimento não pode estar no futuro.";
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = "Por favor, digite um e-mail válido (ex: nome@email.com)";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    updateFormData?.({ birthDate: isoBirthDate });
    onSubmit();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Revise e confirme seu agendamento</h3>
        <p className="text-sm text-muted-foreground">
          Confira se tudo está correto. Depois é só aguardar nosso contato.
        </p>
      </div>

      {collectDeferredPersonalDetails && (
        <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
          <div className="space-y-2">
            <Label htmlFor="birthDate-final" className="flex items-center gap-2 text-foreground">
              <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
              Data de nascimento *
            </Label>
            <Input
              id="birthDate-final"
              value={birthDateBr}
              onChange={(event) => {
                const masked = maskBirthDate(event.target.value);
                setBirthDateBr(masked);
                updateFormData?.({ birthDate: brToIso(masked) });
                setErrors((current) => ({ ...current, birthDate: undefined }));
              }}
              inputMode="numeric"
              autoComplete="bday"
              placeholder="dd/mm/aaaa"
              maxLength={10}
              aria-required="true"
              aria-invalid={!!errors.birthDate}
              aria-describedby={errors.birthDate ? "birthDate-final-error" : undefined}
              className="min-h-12 bg-secondary border-border focus:border-primary"
            />
            {errors.birthDate && <p id="birthDate-final-error" role="alert" className="text-sm text-destructive">{errors.birthDate}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-final" className="flex items-center gap-2 text-foreground">
              <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
              E-mail (opcional)
            </Label>
            <Input
              id="email-final"
              type="email"
              value={formData.email}
              onChange={(event) => {
                updateFormData?.({ email: event.target.value });
                setErrors((current) => ({ ...current, email: undefined }));
              }}
              autoComplete="email"
              placeholder="seu@email.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-final-error" : undefined}
              className="min-h-12 bg-secondary border-border focus:border-primary"
            />
            {errors.email && <p id="email-final-error" role="alert" className="text-sm text-destructive">{errors.email}</p>}
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="card-glass rounded-2xl p-6 space-y-4">
        {summaryItems.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-foreground font-medium">{item.value}</p>
            </div>
          </div>
        ))}

        {/* Preferences */}
        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {formData.acceptFirstAvailable ? (
              <Check className="w-4 h-4 text-primary" />
            ) : (
              <div className="w-4 h-4 rounded border border-border" />
            )}
            <span className="text-muted-foreground">
              Aceita primeiro horário disponível
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {formData.acceptNotifications ? (
              <Check className="w-4 h-4 text-primary" />
            ) : (
              <div className="w-4 h-4 rounded border border-border" />
            )}
            <span className="text-muted-foreground">
              Aceita receber notificações
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrev}>
          Voltar
        </Button>
        <Button variant="hero" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isSubmitting ? "Enviando..." : "Confirmar agendamento"}
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationStep;
