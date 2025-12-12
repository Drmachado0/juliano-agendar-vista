import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormData } from "./SchedulingModal";
import { useState, useEffect } from "react";
import { Stethoscope, MapPin, Shield, Loader2 } from "lucide-react";
import { listarClinicas, Clinica } from "@/services/clinicas";
import { listarConvenios, Convenio } from "@/services/convenios";
import { listarTiposAtendimento, TipoAtendimento } from "@/services/tiposAtendimento";

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
  const [loading, setLoading] = useState(true);
  
  const [tiposAtendimento, setTiposAtendimento] = useState<TipoAtendimento[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    const [tiposRes, clinicasRes, conveniosRes] = await Promise.all([
      listarTiposAtendimento(),
      listarClinicas(),
      listarConvenios(),
    ]);

    if (tiposRes.data) setTiposAtendimento(tiposRes.data);
    if (clinicasRes.data) setClinicas(clinicasRes.data);
    if (conveniosRes.data) setConvenios(conveniosRes.data);
    setLoading(false);
  }

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

  // Check if "outro" option exists in convenios
  const hasOutroOption = convenios.some(c => c.slug === 'outro');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            onValueChange={(value) => {
              const tipo = tiposAtendimento.find(t => t.slug === value);
              updateFormData({ 
                appointmentType: value,
                appointmentTypeName: tipo?.nome || value
              });
            }}
            className="grid grid-cols-1 gap-2"
          >
            {tiposAtendimento.map((tipo) => (
              <Label
                key={tipo.id}
                htmlFor={tipo.slug}
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  formData.appointmentType === tipo.slug
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value={tipo.slug} id={tipo.slug} />
                <span className="text-foreground">
                  {tipo.nome}
                  {tipo.descricao && (
                    <span className="text-muted-foreground"> ({tipo.descricao})</span>
                  )}
                </span>
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
            onValueChange={(value) => {
              const clinica = clinicas.find(c => c.slug === value);
              updateFormData({ 
                location: value,
                locationName: clinica?.nome || value
              });
            }}
            className="grid grid-cols-1 gap-2"
          >
            {clinicas.map((clinica) => (
              <Label
                key={clinica.id}
                htmlFor={`loc-${clinica.slug}`}
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  formData.location === clinica.slug
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value={clinica.slug} id={`loc-${clinica.slug}`} />
                <span className="text-foreground">{clinica.nome}</span>
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
            onValueChange={(value) => {
              const convenio = convenios.find(c => c.slug === value);
              updateFormData({ 
                insurance: value,
                insuranceName: convenio?.nome || (value === 'outro' ? 'Outro' : value)
              });
            }}
            className="grid grid-cols-2 gap-2"
          >
            {convenios.map((convenio) => (
              <Label
                key={convenio.id}
                htmlFor={`ins-${convenio.slug}`}
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  formData.insurance === convenio.slug
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value={convenio.slug} id={`ins-${convenio.slug}`} />
                <span className="text-foreground text-sm">{convenio.nome}</span>
              </Label>
            ))}
            {/* Always show "Outro" option */}
            {!hasOutroOption && (
              <Label
                htmlFor="ins-outro"
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  formData.insurance === "outro"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="outro" id="ins-outro" />
                <span className="text-foreground text-sm">Outro</span>
              </Label>
            )}
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
