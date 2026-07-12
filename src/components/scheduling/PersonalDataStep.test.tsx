import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PersonalDataStep from "./PersonalDataStep";
import type { FormData } from "./SchedulingModal";

const baseData: FormData = {
  fullName: "Maria Oliveira",
  phone: "(91) 99999-9999",
  birthDate: "",
  email: "",
  appointmentType: "",
  appointmentTypeName: "",
  location: "",
  locationName: "",
  insurance: "",
  insuranceName: "",
  otherInsurance: "",
  selectedDate: undefined,
  selectedTime: "",
  acceptFirstAvailable: false,
  acceptNotifications: true,
};

function setup(overrides: Partial<FormData> = {}) {
  const onNext = vi.fn();
  const updateFormData = vi.fn();
  render(
    <PersonalDataStep
      formData={{ ...baseData, ...overrides }}
      updateFormData={updateFormData}
      onNext={onNext}
    />,
  );
  return { onNext, updateFormData };
}

const advance = () => fireEvent.click(screen.getByRole("button", { name: /avançar/i }));

const typeBirth = (val: string) => {
  const input = screen.getByLabelText(/data de nascimento/i) as HTMLInputElement;
  fireEvent.change(input, { target: { value: val } });
  return input;
};

describe("PersonalDataStep — data de nascimento obrigatória", () => {
  it("label mostra asterisco (obrigatório) e não 'opcional'", () => {
    setup();
    const label = screen.getByText(/data de nascimento/i).textContent || "";
    expect(label).toContain("*");
    expect(label.toLowerCase()).not.toContain("opcional");
  });

  it("input tem aria-required, autocomplete=bday, inputmode=numeric", () => {
    setup();
    const input = screen.getByLabelText(/data de nascimento/i);
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input.getAttribute("autocomplete")).toBe("bday");
    expect(input.getAttribute("inputmode")).toBe("numeric");
  });

  it("vazio bloqueia avanço com mensagem específica", () => {
    const { onNext } = setup();
    advance();
    expect(screen.getByText("Informe a data de nascimento.")).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("data válida permite avançar", () => {
    const { onNext } = setup({ birthDate: "1990-05-20" });
    // Recria com valor inicial já preenchido; simplesmente clica
    advance();
    expect(onNext).toHaveBeenCalled();
  });

  it("data futura bloqueia com mensagem específica", () => {
    const { onNext } = setup();
    typeBirth("01/01/2999");
    advance();
    expect(
      screen.getByText("A data de nascimento não pode estar no futuro."),
    ).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("ano < 1900 bloqueia", () => {
    const { onNext } = setup();
    typeBirth("01/01/1899");
    advance();
    expect(
      screen.getByText("Digite uma data válida no formato DD/MM/AAAA."),
    ).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("29/02 em ano NÃO bissexto (2023) bloqueia", () => {
    const { onNext } = setup();
    typeBirth("29/02/2023");
    advance();
    expect(
      screen.getByText("Digite uma data válida no formato DD/MM/AAAA."),
    ).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("29/02 em ano bissexto (2020) é aceito", () => {
    const { onNext } = setup();
    typeBirth("29/02/2020");
    advance();
    expect(onNext).toHaveBeenCalled();
  });

  it("erro se limpa quando a data se torna válida", () => {
    setup();
    typeBirth("01/01/2999");
    advance();
    expect(screen.getByText(/futuro/i)).toBeInTheDocument();
    typeBirth("15/06/1988");
    expect(screen.queryByText(/futuro/i)).toBeNull();
  });

  it("aria-invalid e aria-describedby são setados quando há erro", () => {
    setup();
    advance();
    const input = screen.getByLabelText(/data de nascimento/i);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("birthDate-error");
  });

  it("e-mail permanece opcional", () => {
    const { onNext } = setup({ birthDate: "1990-05-20", email: "" });
    advance();
    expect(onNext).toHaveBeenCalled();
  });
});
