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

// Converte ISO (yyyy-mm-dd) para BR (dd/mm/aaaa)
const isoToBr = (iso: string) => {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
};

// Converte BR (dd/mm/aaaa) para ISO (yyyy-mm-dd) — retorna "" se incompleto/inválido
const brToIso = (br: string) => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  const ano = parseInt(m[3], 10);
  const d = new Date(ano, mes - 1, dia);
  if (
    d.getFullYear() !== ano ||
    d.getMonth() !== mes - 1 ||
    d.getDate() !== dia
  ) {
    return "";
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
};

// Aplica máscara dd/mm/aaaa enquanto digita
const formatBirthDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const PersonalDataStep = ({ formData, updateFormData, onNext }: PersonalDataStepProps) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [birthDateBr, setBirthDateBr] = useState<string>(isoToBr(formData.birthDate || ""));

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = formatBirthDateInput(e.target.value);
    setBirthDateBr(masked);

    if (masked.length === 10) {
      const iso = brToIso(masked);
      if (iso) {
        updateFormData({ birthDate: iso });
        setErrors((prev) => {
          const { birthDate, ...rest } = prev;
          return rest;
        });
      } else {
        updateFormData({ birthDate: "" });
        setErrors((prev) => ({ ...prev, birthDate: "Data inválida" }));
      }
    } else {
      updateFormData({ birthDate: "" });
      setErrors((prev) => {
        const { birthDate, ...rest } = prev;
        return rest;
      });
    }
  };

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

    // Nome completo: obrigatório, mínimo 2 palavras, apenas letras
    const nome = formData.fullName.trim();
    if (!nome) {
      newErrors.fullName = "Nome completo é obrigatório";
    } else if (nome.length < 3) {
      newErrors.fullName = "Nome muito curto (mínimo 3 caracteres)";
    } else if (!/\s/.test(nome) || nome.split(/\s+/).filter(Boolean).length < 2) {
      newErrors.fullName = "Informe nome e sobrenome";
    } else if (!/^[A-Za-zÀ-ÿ\s'-]+$/.test(nome)) {
      newErrors.fullName = "Nome deve conter apenas letras";
    }

    // Telefone: obrigatório, DDD válido (11-99) + 10 ou 11 dígitos
    const digits = formData.phone.replace(/\D/g, "");
    if (!formData.phone.trim()) {
      newErrors.phone = "Telefone (WhatsApp) é obrigatório";
    } else if (digits.length < 10 || digits.length > 11) {
      newErrors.phone = "Telefone deve ter DDD + número (ex: (91) 99999-9999)";
    } else {
      const ddd = parseInt(digits.slice(0, 2), 10);
      if (ddd < 11 || ddd > 99) {
        newErrors.phone = "DDD inválido";
      } else if (digits.length === 11 && digits[2] !== "9") {
        newErrors.phone = "Celular deve começar com 9 após o DDD";
      }
    }

    // E-mail: opcional, mas se preenchido precisa ser válido
    const emailVal = formData.email.trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      newErrors.email = "E-mail inválido";
    }

    // Data de nascimento é opcional, mas se preenchida precisa estar completa e válida
    if (birthDateBr.trim()) {
      if (birthDateBr.length !== 10 || !brToIso(birthDateBr)) {
        newErrors.birthDate = "Data inválida. Use o formato dd/mm/aaaa";
      }
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
            type="text"
            inputMode="numeric"
            value={birthDateBr}
            onChange={handleBirthDateChange}
            placeholder="dd/mm/aaaa"
            maxLength={10}
            className={`bg-secondary border-border focus:border-primary ${
              errors.birthDate ? "border-destructive" : ""
            }`}
          />
          {errors.birthDate && (
            <p className="text-sm text-destructive">{errors.birthDate}</p>
          )}
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
            placeholder="seu@email.com (opcional)"
            className={`bg-secondary border-border focus:border-primary ${
              errors.email ? "border-destructive" : ""
            }`}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
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
