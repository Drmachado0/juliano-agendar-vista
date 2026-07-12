import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ParagominasConfirmationStep from "./ParagominasConfirmationStep";
import type { FormData } from "./SchedulingModal";

const baseData: FormData = {
  fullName: "Maria da Silva",
  phone: "91991150174",
  birthDate: "1988-03-14",
  email: "",
  appointmentType: "consulta",
  appointmentTypeName: "Consulta",
  location: "clinicor",
  locationName: "Clinicor – Paragominas",
  insurance: "particular",
  insuranceName: "Particular",
  otherInsurance: "",
  selectedDate: new Date("2026-08-12T12:00:00"),
  selectedTime: "14:30",
  acceptFirstAvailable: true,
  acceptNotifications: false,
};

const renderStep = (overrides: Partial<FormData> = {}, props: Partial<React.ComponentProps<typeof ParagominasConfirmationStep>> = {}) =>
  render(
    <ParagominasConfirmationStep
      formData={{ ...baseData, ...overrides }}
      onSubmit={vi.fn()}
      onPrev={vi.fn()}
      onEditStep={vi.fn()}
      {...props}
    />,
  );

describe("ParagominasConfirmationStep — summary premium", () => {
  it("mostra data de nascimento em DD/MM/AAAA (não ISO)", () => {
    renderStep();
    expect(screen.getByText("14/03/1988")).toBeInTheDocument();
    expect(screen.queryByText("1988-03-14")).toBeNull();
  });

  it("substitui e-mail vazio por 'Não informado'", () => {
    renderStep({ email: "" });
    expect(screen.getAllByText(/não informado/i).length).toBeGreaterThan(0);
  });

  it("nunca renderiza 'undefined' ou 'null' literal", () => {
    const { container } = renderStep({ locationName: "", location: "" });
    expect(container.textContent).not.toMatch(/\bundefined\b/);
    expect(container.textContent).not.toMatch(/\bnull\b/);
  });

  it("formata telefone brasileiro", () => {
    renderStep();
    expect(screen.getByText("(91) 99115-0174")).toBeInTheDocument();
  });

  it("mostra preferências como Sim/Não explícitos", () => {
    renderStep();
    // Primeiro horário: Sim
    expect(screen.getByText(/primeiro horário disponível/i).textContent).toMatch(/sim/i);
    // Lembretes WhatsApp: Não
    expect(screen.getByText(/lembretes pelo whatsapp/i).textContent).toMatch(/não/i);
  });

  it("botões têm min-height mobile-first e ordem visual Confirmar em cima", () => {
    renderStep();
    const confirmar = screen.getByRole("button", { name: /confirmar agendamento/i });
    const voltar = screen.getByRole("button", { name: /voltar/i });
    expect(confirmar.className).toMatch(/min-h-\[56px\]/);
    expect(confirmar.className).toMatch(/w-full/);
    expect(voltar.className).toMatch(/min-h-\[52px\]/);
    expect(voltar.className).toMatch(/w-full/);
  });

  it("estado loading substitui rótulo por 'Confirmando...'", () => {
    renderStep({}, { isSubmitting: true });
    expect(screen.getByRole("button", { name: /confirmando/i })).toBeDisabled();
  });

  it("Editar chama onEditStep com a etapa correspondente", () => {
    const onEditStep = vi.fn();
    renderStep({}, { onEditStep });
    fireEvent.click(screen.getByRole("button", { name: /editar seus dados/i }));
    expect(onEditStep).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: /editar atendimento/i }));
    expect(onEditStep).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: /editar data e horário/i }));
    expect(onEditStep).toHaveBeenCalledWith(3);
  });

  it("não usa fundo navy escuro (card-glass) no summary", () => {
    const { container } = renderStep();
    expect(container.querySelector(".card-glass")).toBeNull();
    // Superfície principal deve ser marfim claro
    const card = container.querySelector(".pgm-summary-card") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.style.background.toLowerCase()).toMatch(/#faf8f2|250,\s*248,\s*242/);
  });
});
