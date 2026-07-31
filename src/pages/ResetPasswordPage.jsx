import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function updatePassword(event) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setMessage("La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y un número.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(`No se pudo actualizar la contraseña: ${error.message}`);
    } else {
      setCompleted(true);
      setMessage("Contraseña actualizada correctamente.");
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    }
    setSaving(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/" aria-label="Volver al inicio"><span className="brand-mark">S</span><span>SecureHome</span></Link>
        <h1>Nueva contraseña</h1>
        <p>Escribe y confirma la contraseña que utilizarás desde ahora.</p>
        <form className="auth-form" onSubmit={updatePassword}>
          <label>Nueva contraseña
            <input type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={event => setPassword(event.target.value)} required/>
          </label>
          <label>Confirmar contraseña
            <input type="password" placeholder="Confirmar contraseña" value={confirmation} onChange={event => setConfirmation(event.target.value)} required/>
          </label>
          {message && <p className="auth-message" role="status">{message}</p>}
          <button type="submit" disabled={saving || completed}>{saving ? "Actualizando..." : completed ? "Contraseña actualizada" : "Guardar contraseña nueva"}</button>
        </form>
      </section>
    </main>
  );
}

export default ResetPasswordPage;
