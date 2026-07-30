import { createContext, useContext } from "react";

export const AuthStateContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthStateContext);
  if (!context) throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  return context;
}
