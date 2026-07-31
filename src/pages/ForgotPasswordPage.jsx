import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function sendRecoveryEmail(event) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/restablecer-contrasena` }
    );
    setMessage(error
      ? `No se pudo enviar el enlace: ${error.message}`
      : "Si el correo está registrado, recibirás un enlace para crear una contraseña nueva.");
    setSending(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/" aria-label="Volver al inicio"><span className="brand-mark">S</span><span>SecureHome</span></Link>
        <h1>Recuperar contraseña</h1>
        <p>Te enviaremos un enlace seguro al correo de tu cuenta.</p>
        <form className="auth-form" onSubmit={sendRecoveryEmail}>
          <label>Correo electrónico
            <input type="email" placeholder="Correo electrónico" value={email} onChange={event => setEmail(event.target.value)} required/>
          </label>
          {message && <p className="auth-message" role="status">{message}</p>}
          <button type="submit" disabled={sending}>{sending ? "Enviando..." : "Enviar enlace de recuperación"}</button>
        </form>
        <p><Link to="/login">← Volver a iniciar sesión</Link></p>
      </section>
    </main>
  );
}

export default ForgotPasswordPage;
