import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormData } from "./SchedulingModal";
import { useState } from "react";
import { Stethoscope, MapPin, Shield } from "lucide-react";

interface ConsultationDetailsStepProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const ConsultationDetailsStep = ({
  formData,
  updateFormData,
  onNext,
  onPrev,
}: ConsultationDetailsStepProps) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const appointmentTypes = [
    { value: "consulta", label: "Consulta" },
    { value: "retorno", label: "Retorno" },
    { value: "exame", label: "Exame (campo visual, OCT, mapeamento etc.)" },
    { value: "cirurgia", label: "Cirurgia (catarata, pterígio etc.)" },
  ];

  const locations = [
    { value: "clinicor", label: "Clinicor – Paragominas" },
    { value: "hgp", label: "Hospital Geral de Paragominas" },
    { value: "belem", label: "Belém (IOB / Vitria)" },
  ];

  const insurances = [
    { value: "particular", label: "Particular" },
    { value: "bradesco", label: "Bradesco" },
    { value: "unimed", label: "Unimed" },
    { value: "cassi", label: "Cassi" },
    { value: "sulamerica", label: "Sul América" },
    { value: "outro", label: "Outro" },
  ];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.appointmentType) {
      newErrors.appointmentType = "Selecione o tipo de atendimento";
    }

    if (!formData.location) {
      newErrors.location = "Selecione o local de atendimento";
    }

    if (!formData.insurance) {
      newErrors.insurance = "Selecione o convênio";
    }

    if (formData.insurance === "outro" && !formData.otherInsurance.trim()) {
      newErrors.otherInsurance = "Informe o nome do convênio";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Detalhes da consulta</h3>
        <p className="text-sm text-muted-foreground">
          Informe os detalhes do atendimento desejado.
        </p>
      </div>

      <div className="space-y-6">
        {/* Appointment Type */}
        <div className="space-y-3">
          <Label className="text-foreground flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            Tipo de atendimento *
          </Label>
          <RadioGroup
            value={formData.appointmentType}
            onValueChange={(value) => updateFormData({ appointmentType: value })}
            className="grid grid-cols-1 gap-2"
          >
            {appointmentTypes.map((type) => (
              <Label
                key={type.value}
                htmlFor={type.value}
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  formData.appointmentType === type.value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value={type.value} id={type.value} />
                <span className="text-foreground">{type.label}</span>
              </Label>
            ))}
          </RadioGroup>
          {errors.appointmentType && (
            <p className="text-sm text-destructive">{errors.appointmentType}</p>
          )}
        </div>

        {/* Location */}
        <div className="space-y-3">
          <Label className="text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Local do atendimento *
          </Label>
          <RadioGroup
            value={formData.location}
            onValueChange={(value) => updateFormData({ location: value })}
            className="grid grid-cols-1 gap-2"
          >
            {locations.map((loc) => (
              <Label
                key={loc.value}
                htmlFor={`loc-${loc.value}`}
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  formData.location === loc.value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value={loc.value} id={`loc-${loc.value}`} />
                <span className="text-foreground">{loc.label}</span>
              </Label>
            ))}
          </RadioGroup>
          {errors.location && (
            <p className="text-sm text-destructive">{errors.location}</p>
          )}
        </div>

        {/* Insurance */}
        <div className="space-y-3">
          <Label className="text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Convênio *
          </Label>
          <RadioGroup
            value={formData.insurance}
            onValueChange={(value) => updateFormData({ insurance: value })}
            className="grid grid-cols-2 gap-2"
          >
            {insurances.map((ins) => (
              <Label
                key={ins.value}
                htmlFor={`ins-${ins.value}`}
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  formData.insurance === ins.value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value={ins.value} id={`ins-${ins.value}`} />
                <span className="text-foreground text-sm">{ins.label}</span>
              </Label>
            ))}
          </RadioGroup>
          {errors.insurance && (
            <p className="text-sm text-destructive">{errors.insurance}</p>
          )}

          {formData.insurance === "outro" && (
            <div className="mt-3">
              <Input
                value={formData.otherInsurance}
                onChange={(e) => updateFormData({ otherInsurance: e.target.value })}
                placeholder="Nome do convênio"
                className={`bg-secondary border-border focus:border-primary ${
                  errors.otherInsurance ? "border-destructive" : ""
                }`}
              />
              {errors.otherInsurance && (
                <p className="text-sm text-destructive mt-1">{errors.otherInsurance}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrev}>
          Voltar
        </Button>
        <Button variant="hero" onClick={handleNext}>
          Avançar
        </Button>
      </div>
    </div>
  );
};

export default ConsultationDetailsStep;
