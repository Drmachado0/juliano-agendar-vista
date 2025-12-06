import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function validatePasswordStrength(password: string): { 
  isValid: boolean; 
  requirements: PasswordRequirement[] 
} {
  const requirements: PasswordRequirement[] = [
    { label: "Mínimo 8 caracteres", met: password.length >= 8 },
    { label: "Letra maiúscula (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Letra minúscula (a-z)", met: /[a-z]/.test(password) },
    { label: "Número (0-9)", met: /[0-9]/.test(password) },
    { label: "Caractere especial (!@#$%...)", met: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~';]/.test(password) },
  ];

  const isValid = requirements.every((req) => req.met);

  return { isValid, requirements };
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { requirements } = validatePasswordStrength(password);
  const metCount = requirements.filter((r) => r.met).length;
  
  const getStrengthColor = () => {
    if (metCount <= 2) return "bg-destructive";
    if (metCount <= 3) return "bg-orange-500";
    if (metCount <= 4) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthLabel = () => {
    if (metCount <= 2) return "Fraca";
    if (metCount <= 3) return "Regular";
    if (metCount <= 4) return "Boa";
    return "Forte";
  };

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Barra de força */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Força da senha:</span>
          <span className={cn(
            "font-medium",
            metCount <= 2 && "text-destructive",
            metCount === 3 && "text-orange-500",
            metCount === 4 && "text-yellow-600",
            metCount === 5 && "text-green-600"
          )}>
            {getStrengthLabel()}
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-300", getStrengthColor())}
            style={{ width: `${(metCount / requirements.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Lista de requisitos */}
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li 
            key={index} 
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              req.met ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {req.met ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
