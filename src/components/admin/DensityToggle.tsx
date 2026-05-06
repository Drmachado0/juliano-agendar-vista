import { Rows3, Rows2 } from "lucide-react";
import { useDensity, type Density } from "@/hooks/useDensity";
import { cn } from "@/lib/utils";

const options: { value: Density; label: string; Icon: typeof Rows3 }[] = [
  { value: "compact", label: "Compacto", Icon: Rows3 },
  { value: "comfortable", label: "Confortável", Icon: Rows2 },
];

interface DensityToggleProps {
  className?: string;
}

const DensityToggle = ({ className }: DensityToggleProps) => {
  const { density, setDensity } = useDensity();
  return (
    <div
      className={cn(
        "flex rounded-md border border-border/70 overflow-hidden text-xs",
        className
      )}
      role="group"
      aria-label="Densidade visual"
    >
      {options.map((o) => {
        const active = density === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setDensity(o.value)}
            aria-pressed={active}
            title={o.label}
            className={cn(
              "px-2.5 py-1 transition-colors flex items-center gap-1.5",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted text-muted-foreground"
            )}
          >
            <o.Icon className="h-3.5 w-3.5" />
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DensityToggle;
