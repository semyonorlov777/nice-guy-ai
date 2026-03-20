"use client";

import { createContext, useContext } from "react";
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
  return (
    <ModesContext.Provider value={{ modes }}>{children}</ModesContext.Provider>
  );
}

export const useModes = () => useContext(ModesContext);
