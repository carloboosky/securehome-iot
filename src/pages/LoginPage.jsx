import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function LoginPage() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(evento) {
    evento.preventDefault();
    setMensaje("");
    setCargando(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password,
    });

    if (error) {
      setMensaje("Correo o contraseña incorrectos.");
      setCargando(false);
      return;
    }

    await redirigirSegunRol(data.user.id);
  }

  async function iniciarSesionConGoogle() {
    setMensaje("");
    setCargando(true);

    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setMensaje(`No se pudo iniciar sesión con Google: ${error.message}`);
      setCargando(false);
    }
  }

  async function redirigirSegunRol(userId) {
    const { data: perfil, error: perfilError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (perfilError) {
      setMensaje("No se pudo obtener el perfil del usuario.");
      setCargando(false);
      return;
    }

    if (perfil?.role === "admin") {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }

    setCargando(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Iniciar sesión</h1>

        <button
          type="button"
          className="google-button"
          onClick={iniciarSesionConGoogle}
          disabled={cargando}
        >
          Continuar con Google
        </button>

        <div className="auth-divider">
          <span>o inicia sesión con correo</span>
        </div>

        <form onSubmit={iniciarSesion} className="auth-form">
          <label>
            Correo
            <input
              type="email"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              required
            />
          </label>

          {mensaje && <p className="auth-message">{mensaje}</p>}

          <button type="submit" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p>
          ¿No tienes una cuenta? <Link to="/registro">Regístrate</Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;