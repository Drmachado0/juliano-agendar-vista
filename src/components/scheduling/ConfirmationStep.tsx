import { Button } from "@/components/ui/button";
import { FormData } from "./SchedulingModal";
import { User, Phone, Calendar, Mail, Stethoscope, MapPin, Shield, Clock, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConfirmationStepProps {
  formData: FormData;
  onSubmit: () => void;
  onPrev: () => void;
  isSubmitting?: boolean;
}

const ConfirmationStep = ({ formData, onSubmit, onPrev, isSubmitting = false }: ConfirmationStepProps) => {
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Confirme seus dados</h3>
        <p className="text-sm text-muted-foreground">
          Revise as informações antes de confirmar o agendamento.
        </p>
      </div>

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
        <Button variant="hero" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isSubmitting ? "Enviando..." : "Confirmar agendamento"}
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationStep;
