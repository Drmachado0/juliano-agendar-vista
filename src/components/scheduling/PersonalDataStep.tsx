import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormData } from "./SchedulingModal";
import { useState } from "react";
import { User, Phone, Calendar, Mail } from "lucide-react";

interface PersonalDataStepProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

const PersonalDataStep = ({ formData, updateFormData, onNext }: PersonalDataStepProps) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers
        .replace(/^(\d{2})/, "($1) ")
        .replace(/(\d{5})(\d)/, "$1-$2")
        .trim();
    }
    return value.slice(0, 15);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    updateFormData({ phone: formatted });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Nome completo é obrigatório";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Telefone (WhatsApp) é obrigatório";
    } else if (formData.phone.replace(/\D/g, "").length < 10) {
      newErrors.phone = "Telefone inválido";
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
        <h3 className="text-lg font-semibold text-foreground">Dados pessoais</h3>
        <p className="text-sm text-muted-foreground">
          Preencha seus dados para agendarmos sua consulta.
        </p>
      </div>

      <div className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Nome completo *
          </Label>
          <Input
            id="fullName"
            value={formData.fullName}
            onChange={(e) => updateFormData({ fullName: e.target.value })}
            placeholder="Digite seu nome completo"
            className={`bg-secondary border-border focus:border-primary ${
              errors.fullName ? "border-destructive" : ""
            }`}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-foreground flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            Telefone (WhatsApp) *
          </Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={handlePhoneChange}
            placeholder="(00) 00000-0000"
            className={`bg-secondary border-border focus:border-primary ${
              errors.phone ? "border-destructive" : ""
            }`}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone}</p>
          )}
        </div>

        {/* Birth Date */}
        <div className="space-y-2">
          <Label htmlFor="birthDate" className="text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Data de nascimento
          </Label>
          <Input
            id="birthDate"
            type="date"
            value={formData.birthDate}
            onChange={(e) => updateFormData({ birthDate: e.target.value })}
            className="bg-secondary border-border focus:border-primary"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            E-mail
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData({ email: e.target.value })}
            placeholder="seu@email.com"
            className="bg-secondary border-border focus:border-primary"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button variant="hero" onClick={handleNext}>
          Avançar
        </Button>
      </div>
    </div>
  );
};

export default PersonalDataStep;
