import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState("Completando inicio de sesión...");

  useEffect(() => {
    async function procesarInicioDeSesion() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        setMensaje("No se pudo completar el inicio de sesión con Google.");
        return;
      }

      const usuario = session.user;

      const { data: perfil, error: perfilError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", usuario.id)
        .maybeSingle();

      if (perfilError) {
        setMensaje("No se pudo consultar el perfil del usuario.");
        return;
      }

      /*
       * El primer ingreso con Google puede crear el usuario en Auth,
       * pero todavía no existir en la tabla profiles.
       */
      if (!perfil) {
        const { error: crearPerfilError } = await supabase
          .from("profiles")
          .insert({
            id: usuario.id,
            email: usuario.email,
            full_name:
              usuario.user_metadata?.full_name ||
              usuario.user_metadata?.name ||
              "",
            role: "client",
          });

        if (crearPerfilError) {
          console.error(crearPerfilError);
          setMensaje(
            "La cuenta de Google se creó, pero no se pudo crear el perfil."
          );
          return;
        }

        navigate("/dashboard", { replace: true });
        return;
      }

      if (perfil.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }

    procesarInicioDeSesion();
  }, [navigate]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p>{mensaje}</p>
      </section>
    </main>
  );
}

export default AuthCallbackPage;