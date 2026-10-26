"use client";

import { createContext, useContext } from "react";

const empty = { companies: [], sectors: [], projectTypes: [], serviceGroups: [], servicePages: [] };
const OptionsContext = createContext(empty);

/** The website's option lists from Settings → Company profile, for client components. */
export function OptionsProvider({ value, children }) {
  return <OptionsContext.Provider value={value || empty}>{children}</OptionsContext.Provider>;
}

export const useWebsiteOptions = () => useContext(OptionsContext);
