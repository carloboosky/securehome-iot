import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthStateContext } from "./auth";

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function resolveSession(nextSession) {
      if (!active) return;
      setSession(nextSession);

      if (!nextSession?.user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", nextSession.user.id)
        .maybeSingle();

      if (!active) return;
      setRole(
        error
          ? null
          : data?.role?.trim().toLowerCase() || "client"
      );
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => resolveSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      // Supabase recomienda no esperar otras operaciones del cliente dentro
      // de este callback. Se difiere la consulta del perfil para no bloquear
      // el intercambio del codigo OAuth.
      setTimeout(() => resolveSession(nextSession), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthStateContext.Provider value={{ session, role, loading }}>
      {children}
    </AuthStateContext.Provider>
  );
}

export default AuthProvider;
