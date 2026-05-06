import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

export type Density = "compact" | "comfortable";

const STORAGE_KEY = "crm:density:v1";

interface DensityContextValue {
  density: Density;
  setDensity: (d: Density) => void;
  toggle: () => void;
  isCompact: boolean;
  isComfortable: boolean;
}

const DensityContext = createContext<DensityContextValue | null>(null);

const loadInitial = (): Density => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "comfortable" ? "comfortable" : "compact";
  } catch {
    return "compact";
  }
};

export const DensityProvider = ({ children }: { children: ReactNode }) => {
  const [density, setDensityState] = useState<Density>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, density);
    } catch {
      /* ignore */
    }
  }, [density]);

  const setDensity = useCallback((d: Density) => setDensityState(d), []);
  const toggle = useCallback(
    () => setDensityState((d) => (d === "compact" ? "comfortable" : "compact")),
    []
  );

  return (
    <DensityContext.Provider
      value={{
        density,
        setDensity,
        toggle,
        isCompact: density === "compact",
        isComfortable: density === "comfortable",
      }}
    >
      {children}
    </DensityContext.Provider>
  );
};

export const useDensity = (): DensityContextValue => {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    return {
      density: "compact",
      setDensity: () => {},
      toggle: () => {},
      isCompact: true,
      isComfortable: false,
    };
  }
  return ctx;
};
