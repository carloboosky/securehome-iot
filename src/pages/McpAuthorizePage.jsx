import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

function McpAuthorizePage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const oauthParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("code");
    return params.toString();
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && active) setMessage(`No se pudo completar el login: ${error.message}`);
        window.history.replaceState({}, "", `/autorizar-mcp?${oauthParams}`);
      }
      const { data } = await supabase.auth.getSession();
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    }
    initialize();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [oauthParams]);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage("Correo o contraseña incorrectos.");
    else setSession(data.session);
    setLoading(false);
  }

  async function loginWithGoogle() {
    setLoading(true);
    setMessage("");
    const redirectTo = `${window.location.origin}/autorizar-mcp?${oauthParams}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      setMessage(`No se pudo iniciar sesión con Google: ${error.message}`);
      setLoading(false);
    }
  }

  async function authorize() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/oauth/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ oauthParams }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || "No se pudo autorizar el acceso.");
      setLoading(false);
      return;
    }
    window.location.assign(data.redirectTo);
  }

  if (loading && !session) return <main className="auth-page"><section className="auth-card"><p>Preparando autorización segura…</p></section></main>;

  return (
    <main className="auth-page">
      <section className="auth-card mcp-auth-card">
        <Link className="auth-brand" to="/" aria-label="Volver al inicio"><span className="brand-mark">S</span><span>SecureHome</span></Link>
        <h1>Autorizar MCP</h1>
        <p>Una aplicación de IA solicita acceso de solo lectura a SecureHome.</p>

        {session ? (
          <div className="mcp-consent">
            <div><strong>Cuenta</strong><span>{session.user.email}</span></div>
            <ul>
              <li>Consultar solicitudes de instalación</li>
              <li>Consultar cámaras activas</li>
              <li>Consultar residentes y mascotas</li>
            </ul>
            <p>El MCP no puede leer el código, modificar datos ni controlar dispositivos.</p>
            {message && <p className="auth-message">{message}</p>}
            <button type="button" onClick={authorize} disabled={loading}>{loading ? "Autorizando…" : "Autorizar acceso"}</button>
            <button type="button" className="mcp-secondary-button" onClick={() => supabase.auth.signOut()}>Usar otra cuenta</button>
          </div>
        ) : (
          <>
            <button type="button" className="google-button" onClick={loginWithGoogle} disabled={loading}>Continuar con Google</button>
            <div className="auth-divider"><span>o inicia sesión con correo</span></div>
            <form className="auth-form" onSubmit={login}>
              <label>Correo<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
              <label>Contraseña<input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
              {message && <p className="auth-message">{message}</p>}
              <button type="submit" disabled={loading}>{loading ? "Ingresando…" : "Iniciar sesión"}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

export default McpAuthorizePage;
