import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendRecoveryEmail(event) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setMessage("Escribe un correo válido, por ejemplo nombre@correo.com.");
      return;
    }
    setSending(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(
      cleanEmail,
      { redirectTo: `${window.location.origin}/restablecer-contrasena` }
    );
    if (error) {
      const isRateLimit = error.message.toLowerCase().includes("rate") || error.status === 429;
      setMessage(isRateLimit
        ? "Solicitaste varios correos en poco tiempo. Espera unos minutos antes de intentarlo nuevamente."
        : "No pudimos procesar la solicitud en este momento. Revisa tu conexión e inténtalo nuevamente.");
    } else {
      setSent(true);
    }
    setSending(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/" aria-label="Volver al inicio"><span className="brand-mark">S</span><span>SecureHome</span></Link>
        {!sent ? <>
        <span className="recovery-icon"><ShieldCheck aria-hidden="true"/></span>
        <h1>Recupera el acceso a tu cuenta</h1>
        <p>Ingresa el correo asociado a SecureHome. Te enviaremos un enlace seguro para crear una contraseña nueva.</p>
        <form className="auth-form" onSubmit={sendRecoveryEmail} noValidate>
          <label>Correo electrónico
            <span className="recovery-input-wrap"><Mail aria-hidden="true"/><input type="email" autoComplete="email" placeholder="nombre@correo.com" value={email} onChange={event => { setEmail(event.target.value); setMessage(""); }} required/></span>
          </label>
          <small className="recovery-help">Por seguridad, no indicaremos si el correo pertenece o no a una cuenta registrada.</small>
          {message && <p className="auth-message" role="alert">{message}</p>}
          <button type="submit" disabled={sending}>{sending ? "Enviando enlace seguro…" : "Enviar enlace de recuperación"}</button>
        </form>
        <p><Link to="/login">← Volver a iniciar sesión</Link></p>
        </> : <div className="recovery-success" role="status">
          <span><CircleCheck aria-hidden="true"/></span>
          <h1>Revisa tu correo</h1>
          <p>Si existe una cuenta asociada a <strong>{email.trim().toLowerCase()}</strong>, recibirás un enlace para restablecer la contraseña.</p>
          <div><b>¿No encuentras el mensaje?</b><small>Revisa Spam o Correo no deseado. El enlace es temporal y solo debes usar el mensaje más reciente.</small></div>
          <button type="button" onClick={() => { setSent(false); setMessage(""); }}>Enviar a otro correo</button>
          <Link to="/login">← Volver a iniciar sesión</Link>
        </div>}
      </section>
    </main>
  );
}

export default ForgotPasswordPage;
