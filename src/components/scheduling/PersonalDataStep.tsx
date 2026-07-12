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
    // Mantém apenas dígitos e limita a 11 (DDD + 9 dígitos)
    const numbers = value.replace(/\D/g, "").slice(0, 11);

    if (numbers.length === 0) return "";
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 6) {
      // (XX) X ou (XX) XXXX
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    if (numbers.length <= 10) {
      // Formato parcial até 10 dígitos: (XX) XXXX-XXXX
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    }
    // 11 dígitos — celular: (XX) 9XXXX-XXXX
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
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
      newErrors.fullName = "Por favor, informe seu nome completo";
    } else if (nome.length < 3) {
      newErrors.fullName = "O nome precisa ter pelo menos 3 caracteres";
    } else if (!/\s/.test(nome) || nome.split(/\s+/).filter(Boolean).length < 2) {
      newErrors.fullName = "Informe nome e sobrenome para continuarmos";
    } else if (!/^[A-Za-zÀ-ÿ\s'-]+$/.test(nome)) {
      newErrors.fullName = "O nome deve conter apenas letras e espaços";
    }

    // Telefone: obrigatório, DDD válido (11-99) + 10 ou 11 dígitos
    const digits = formData.phone.replace(/\D/g, "");
    if (!formData.phone.trim()) {
      newErrors.phone = "Informe seu WhatsApp para receber a confirmação";
    } else if (digits.length < 10 || digits.length > 11) {
      newErrors.phone = "Digite um número completo com DDD, ex: (91) 99999-9999";
    } else {
      const ddd = parseInt(digits.slice(0, 2), 10);
      if (ddd < 11 || ddd > 99) {
        newErrors.phone = "DDD inválido. Verifique o código de área";
      } else if (digits.length === 11 && digits[2] !== "9") {
        newErrors.phone = "Celular deve começar com 9 após o DDD";
      }
    }

    // E-mail: opcional, mas se preenchido precisa ser válido
    const emailVal = formData.email.trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      newErrors.email = "Por favor, digite um e-mail válido (ex: nome@email.com)";
    }

    // Data de nascimento OBRIGATÓRIA
    const bd = birthDateBr.trim();
    if (!bd) {
      newErrors.birthDate = "Informe a data de nascimento.";
    } else if (bd.length !== 10 || !brToIso(bd)) {
      newErrors.birthDate = "Digite uma data válida no formato DD/MM/AAAA.";
    } else {
      const iso = brToIso(bd);
      const [ano, mes, dia] = iso.split("-").map(Number);
      const dataNasc = new Date(ano, mes - 1, dia);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      if (ano < 1900) {
        newErrors.birthDate = "Digite uma data válida no formato DD/MM/AAAA.";
      } else if (dataNasc > hoje) {
        newErrors.birthDate = "A data de nascimento não pode estar no futuro.";
      }
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
      return;
    }
    // Foca o primeiro campo inválido na ordem visual
    requestAnimationFrame(() => {
      const order = ["fullName", "phone", "birthDate", "email"];
      // Reexecuta validação síncrona para descobrir erros novamente sem depender do setState
      const invalid = order.find((id) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        return el?.getAttribute("aria-invalid") === "true";
      });
      if (invalid) document.getElementById(invalid)?.focus();
    });
  };



  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Quem vai ser atendido?</h3>
        <p className="text-sm text-muted-foreground">
          Preencha seus dados. Vamos confirmar tudo pelo WhatsApp.
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
            placeholder="Ex: Maria Oliveira"
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
            WhatsApp para confirmação *
          </Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={handlePhoneChange}
            placeholder="(91) 99999-9999"
            inputMode="tel"
            maxLength={15}
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
            Data de nascimento (opcional)
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
            E-mail (opcional)
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData({ email: e.target.value })}
            placeholder="seu@email.com"
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
