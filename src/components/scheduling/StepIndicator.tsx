import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const StepIndicator = ({ currentStep, totalSteps }: StepIndicatorProps) => {
  const steps = [
    { number: 1, label: "Dados" },
    { number: 2, label: "Consulta" },
    { number: 3, label: "Data" },
    { number: 4, label: "Confirmar" },
  ];

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                  step.number < currentStep
                    ? "bg-primary text-primary-foreground"
                    : step.number === currentStep
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {step.number < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs mt-2 font-medium hidden sm:block ${
                  step.number <= currentStep ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2">
                <div
                  className={`h-full transition-all duration-300 ${
                    step.number < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Mobile step counter */}
      <div className="sm:hidden text-center mt-4 text-sm text-muted-foreground">
        Passo {currentStep} de {totalSteps}
      </div>
    </div>
  );
};

export default StepIndicator;
