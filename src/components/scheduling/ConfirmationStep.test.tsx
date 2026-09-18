import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmationStep from "./ConfirmationStep";
import type { FormData } from "./SchedulingModal";

const formData: FormData = {
  fullName: "Maria Oliveira",
  phone: "(91) 99999-9999",
  birthDate: "",
  email: "",
  appointmentType: "consulta",
  appointmentTypeName: "Consulta",
  location: "hgp",
  locationName: "Hospital Geral de Paragominas",
  insurance: "particular",
  insuranceName: "Particular",
  otherInsurance: "",
  selectedDate: new Date(2026, 8, 23),
  selectedTime: "09:00",
  acceptFirstAvailable: false,
  acceptNotifications: true,
};

describe("ConfirmationStep — dados pessoais adiados", () => {
  it("valida nascimento e envia nascimento/e-mail junto da confirmação", () => {
    const onSubmit = vi.fn();
    const updateFormData = vi.fn();
    render(
      <ConfirmationStep
        formData={formData}
        onSubmit={onSubmit}
        onPrev={vi.fn()}
        collectDeferredPersonalDetails
        updateFormData={updateFormData}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirmar agendamento/i }));
    expect(screen.getByText("Informe a data de nascimento.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/data de nascimento/i), {
      target: { value: "20/05/1990" },
    });
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: "maria@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar agendamento/i }));

    expect(updateFormData).toHaveBeenLastCalledWith({
      birthDate: "1990-05-20",
      email: "maria@example.com",
    });
    expect(onSubmit).toHaveBeenCalledWith({
      birthDate: "1990-05-20",
      email: "maria@example.com",
    });
  });
});