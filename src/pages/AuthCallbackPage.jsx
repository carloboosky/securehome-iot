import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState(
    "Completando inicio de sesión con Google..."
  );

  useEffect(() => {
    let activo = true;

    async function redirigirUsuario(usuario) {
      const { data: perfil, error: perfilError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", usuario.id)
        .maybeSingle();

      if (perfilError) {
        console.error("Error consultando perfil:", perfilError);
        setMensaje(
          `No se pudo consultar el perfil: ${perfilError.message}`
        );
        return;
      }

      if (!perfil) {
        const { error: crearPerfilError } = await supabase
          .from("profiles")
          .insert({
            id: usuario.id,
            full_name:
              usuario.user_metadata?.full_name ||
              usuario.user_metadata?.name ||
              "",
            role: "client",
          });

        if (crearPerfilError) {
          console.error(
            "Error creando perfil:",
            crearPerfilError
          );

          setMensaje(
            `La cuenta de Google se creó, pero no se pudo crear el perfil: ${crearPerfilError.message}`
          );
          return;
        }
      }

      if (!activo) return;

      if (perfil?.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        const { data: solicitud, error: solicitudError } = await supabase
          .from("service_requests")
          .select("id")
          .eq("client_id", usuario.id)
          .limit(1)
          .maybeSingle();

        if (solicitudError) {
          setMensaje(`No se pudo consultar tu solicitud: ${solicitudError.message}`);
          return;
        }

        navigate(solicitud ? "/dashboard" : "/completar-registro", {
          replace: true,
        });
      }
    }

    async function procesarCallback() {
      try {
        const parametros = new URLSearchParams(
          window.location.search
        );

        const codigo = parametros.get("code");
        const errorDescripcion =
          parametros.get("error_description");

        if (errorDescripcion) {
          setMensaje(
            `Google devolvió un error: ${errorDescripcion}`
          );
          return;
        }

        /*
         * Si Supabase regresó con ?code=..., se intercambia
         * el código por una sesión.
         */
        if (codigo) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(codigo);

          if (error) {
            console.error(
              "Error intercambiando código:",
              error
            );

            setMensaje(
              `No se pudo completar la sesión: ${error.message}`
            );
            return;
          }

          if (data.session?.user) {
            await redirigirUsuario(data.session.user);
            return;
          }
        }

        /*
         * Para el flujo normal del navegador, esperamos
         * el evento de autenticación de Supabase.
         */
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(
          async (evento, session) => {
            if (
              session?.user &&
              (evento === "SIGNED_IN" ||
                evento === "INITIAL_SESSION")
            ) {
              await redirigirUsuario(session.user);
            }
          }
        );

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error obteniendo sesión:", error);
          setMensaje(
            `No se pudo obtener la sesión: ${error.message}`
          );
          subscription.unsubscribe();
          return;
        }

        if (session?.user) {
          await redirigirUsuario(session.user);
          subscription.unsubscribe();
          return;
        }

        /*
         * Da unos segundos a Supabase para procesar
         * los datos que llegaron en la URL.
         */
        setTimeout(async () => {
          const {
            data: { session: sesionFinal },
          } = await supabase.auth.getSession();

          if (!activo) return;

          if (sesionFinal?.user) {
            await redirigirUsuario(sesionFinal.user);
          } else {
            setMensaje(
              "No se encontró una sesión activa. Regresa al inicio de sesión e inténtalo nuevamente."
            );
          }
        }, 2000);

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error("Error en callback:", error);

        setMensaje(
          `Ocurrió un error al iniciar sesión: ${error.message}`
        );
      }
    }

    procesarCallback();

    return () => {
      activo = false;
    };
  }, [navigate]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/" aria-label="Volver al inicio">
          <span className="brand-mark">S</span><span>SecureHome</span>
        </Link>
        <h1>Iniciando sesión</h1>
        <p>{mensaje}</p>

        <button
          type="button"
          onClick={() => navigate("/login")}
        >
          Volver al inicio de sesión
        </button>
      </section>
    </main>
  );
}

export default AuthCallbackPage;
