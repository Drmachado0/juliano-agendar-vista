import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import StepIndicator from "./StepIndicator";
import PersonalDataStep from "./PersonalDataStep";
import ConsultationDetailsStep from "./ConsultationDetailsStep";
import DateTimeStep from "./DateTimeStep";
import ConfirmationStep from "./ConfirmationStep";
import SuccessStep from "./SuccessStep";

export interface FormData {
  // Step 1 - Personal Data
  fullName: string;
  phone: string;
  birthDate: string;
  email: string;
  // Step 2 - Consultation Details
  appointmentType: string;
  location: string;
  insurance: string;
  otherInsurance: string;
  // Step 3 - Date/Time
  selectedDate: Date | undefined;
  selectedTime: string;
  acceptFirstAvailable: boolean;
  acceptNotifications: boolean;
}

const initialFormData: FormData = {
  fullName: "",
  phone: "",
  birthDate: "",
  email: "",
  appointmentType: "",
  location: "",
  insurance: "",
  otherInsurance: "",
  selectedDate: undefined,
  selectedTime: "",
  acceptFirstAvailable: false,
  acceptNotifications: true,
};

interface SchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SchedulingModal = ({ isOpen, onClose }: SchedulingModalProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const totalSteps = 4;

  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    // Here you would integrate with your backend/calendar service
    console.log("Form submitted:", formData);
    setIsSubmitted(true);
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData(initialFormData);
    setIsSubmitted(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {isSubmitted ? "Agendamento enviado!" : "Agendar consulta"}
          </DialogTitle>
        </DialogHeader>

        {!isSubmitted && <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />}

        <div className="mt-6">
          {isSubmitted ? (
            <SuccessStep onClose={handleClose} formData={formData} />
          ) : (
            <>
              {currentStep === 1 && (
                <PersonalDataStep
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={nextStep}
                />
              )}
              {currentStep === 2 && (
                <ConsultationDetailsStep
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={nextStep}
                  onPrev={prevStep}
                />
              )}
              {currentStep === 3 && (
                <DateTimeStep
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={nextStep}
                  onPrev={prevStep}
                />
              )}
              {currentStep === 4 && (
                <ConfirmationStep
                  formData={formData}
                  onSubmit={handleSubmit}
                  onPrev={prevStep}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SchedulingModal;
