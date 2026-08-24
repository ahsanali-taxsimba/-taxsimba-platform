import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => setUser(false))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.two_factor_required) return data; // no session until the code is verified
    setUser(data.user);
    return data.user;
  };

  const verifyTwoFactor = async (challenge, code) => {
    const { data } = await api.post("/auth/login/2fa", { challenge, code });
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setUser(data.user);
    return data.user;
  };

  const refresh = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    return data;
  };

  const logout = async () => {
    localStorage.removeItem("ts_token");
    try {
      await api.post("/auth/logout");
    } catch (e) {}
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyTwoFactor, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
