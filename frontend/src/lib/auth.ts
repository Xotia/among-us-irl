import { createContext, useContext } from "react";
import type { UserRole } from "@among-us-irl/shared";

export interface AuthState {
  token: string;
  role: UserRole;
  userId?: string;
  username?: string;
  sessionId?: string;
  pseudo?: string;
  gameId?: string;
  gameCode?: string;
  reconnectToken?: string;
}

export interface AuthContextValue {
  auth: AuthState | null;
  setAuth: (auth: AuthState | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  auth: null,
  setAuth: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function saveAuth(auth: AuthState) {
  localStorage.setItem("auth_token", auth.token);
  localStorage.setItem("auth_state", JSON.stringify(auth));
}

export function loadAuth(): AuthState | null {
  const raw = localStorage.getItem("auth_state");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_state");
}
