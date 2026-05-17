"use client";

import { createContext, useContext, useMemo } from "react";
import type { ProgramModeWithTemplate } from "@/types/modes";

interface ModesContextType {
  modes: ProgramModeWithTemplate[];
}

const ModesContext = createContext<ModesContextType>({ modes: [] });

export function ModesProvider({
  modes,
  children,
}: {
  modes: ProgramModeWithTemplate[];
  children: React.ReactNode;
}) {
  // Мемоизируем value, иначе все consumers перерендерятся на каждом render
  // Provider'а — даже если modes не изменился.
  const value = useMemo(() => ({ modes }), [modes]);
  return (
    <ModesContext.Provider value={value}>{children}</ModesContext.Provider>
  );
}

export const useModes = () => useContext(ModesContext);
