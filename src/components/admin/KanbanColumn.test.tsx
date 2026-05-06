import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import KanbanColumn from "./KanbanColumn";
import { DensityProvider, useDensity } from "@/hooks/useDensity";
import { useEffect } from "react";

// Mock o KanbanCard para isolar o teste de layout da coluna
vi.mock("./KanbanCard", () => ({
  default: ({ agendamento }: any) => (
    <div data-testid="card-mock">{agendamento.id}</div>
  ),
}));

const baseProps = {
  title: "Novo Lead",
  status: "NOVO LEAD",
  agendamentos: [],
  color: "bg-emerald-500",
  onViewDetails: vi.fn(),
  onSendWhatsApp: vi.fn(),
  onTriggerAutomation: vi.fn(),
  onDragStart: vi.fn(),
  onDragOver: vi.fn(),
  onDrop: vi.fn(),
};

const SetDensity = ({ value }: { value: "compact" | "comfortable" }) => {
  const { setDensity } = useDensity();
  useEffect(() => {
    setDensity(value);
  }, [value, setDensity]);
  return null;
};

const renderWith = (density: "compact" | "comfortable") =>
  render(
    <DensityProvider>
      <SetDensity value={density} />
      <KanbanColumn {...baseProps} />
    </DensityProvider>
  );

describe("KanbanColumn density layout", () => {
  it("aplica classes compactas por padrão", () => {
    const { container } = renderWith("compact");
    const root = container.firstChild as HTMLElement;
    // largura compacta + padding p-3
    expect(root.className).toMatch(/w-\[220px\]/);
    expect(root.className).toMatch(/sm:w-\[280px\]/);
    expect(root.className).toMatch(/\bp-3\b/);
    expect(root.className).not.toMatch(/\bp-4\b/);
  });

  it("aplica classes confortáveis quando density = comfortable", () => {
    const { container } = renderWith("comfortable");
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/w-\[260px\]/);
    expect(root.className).toMatch(/sm:w-\[320px\]/);
    expect(root.className).toMatch(/\bp-4\b/);
    expect(root.className).not.toMatch(/\bp-3\b/);
  });

  it("preserva título, status e contagem (lógica não muda)", () => {
    const { getByText, rerender } = render(
      <DensityProvider>
        <KanbanColumn
          {...baseProps}
          agendamentos={[
            { id: "a" } as any,
            { id: "b" } as any,
            { id: "c" } as any,
          ]}
        />
      </DensityProvider>
    );
    expect(getByText("Novo Lead")).toBeInTheDocument();
    expect(getByText("3")).toBeInTheDocument();

    // Mudar densidade não muda a contagem
    rerender(
      <DensityProvider>
        <SetDensity value="comfortable" />
        <KanbanColumn
          {...baseProps}
          agendamentos={[
            { id: "a" } as any,
            { id: "b" } as any,
            { id: "c" } as any,
          ]}
        />
      </DensityProvider>
    );
    expect(getByText("3")).toBeInTheDocument();
  });
});
