import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function ServiceRequestPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    phone: "",
    planId: "",
    propertyType: "house",
    address: "",
    notes: "",
  });

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const [{ data: request }, { data: profile }, { data: planData, error }] =
        await Promise.all([
          supabase.from("service_requests").select("id").eq("client_id", currentUser.id).limit(1).maybeSingle(),
          supabase.from("profiles").select("phone").eq("id", currentUser.id).maybeSingle(),
          supabase.from("service_plans").select("id,name,price").order("id"),
        ]);

      if (request) {
        navigate("/dashboard", { replace: true });
        return;
      }
      if (error) setMessage(`No se pudieron cargar los planes: ${error.message}`);
      setUser(currentUser);
      setPlans(planData || []);
      setForm(previous => ({ ...previous, phone: profile?.phone || currentUser.user_metadata?.phone || "" }));
      setLoading(false);
    }
    load();
  }, [navigate]);

  function change(event) {
    const { name, value } = event.target;
    const cleanValue = name === "phone" ? value.replace(/\D/g, "").slice(0, 10) : value;
    setForm(previous => ({ ...previous, [name]: cleanValue }));
    setErrors(previous => ({ ...previous, [name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!/^09\d{8}$/.test(form.phone)) nextErrors.phone = "Ingresa un celular ecuatoriano válido de 10 dígitos.";
    if (!form.planId) nextErrors.planId = "Selecciona un plan.";
    if (form.address.trim().length < 8) nextErrors.address = "Escribe una dirección más completa.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Revisa los campos marcados antes de continuar.");
      return;
    }

    setSaving(true);
    setMessage("");
    const { error: profileError } = await supabase.from("profiles").update({ phone: form.phone }).eq("id", user.id);
    if (profileError) {
      setMessage(`No se pudo guardar el teléfono: ${profileError.message}`);
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("service_requests").insert({
      client_id: user.id,
      plan_id: Number(form.planId),
      property_type: form.propertyType,
      installation_address: form.address.trim(),
      notes: form.notes.trim() || null,
      status: "pending",
    });
    if (error) {
      setMessage(`No se pudo guardar la solicitud: ${error.message}`);
      setSaving(false);
      return;
    }
    navigate("/dashboard", { replace: true });
  }

  if (loading) return <main className="dashboard-loading-container"><div className="dashboard-loader"/><p>Preparando formulario...</p></main>;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/" aria-label="Volver al inicio"><span className="brand-mark">S</span><span>SecureHome</span></Link>
        <span className="form-step">Último paso</span>
        <h1>Datos de instalación</h1>
        <p>Completa esta información para preparar tu visita técnica.</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          <label>Teléfono
            <input name="phone" inputMode="numeric" maxLength={10} placeholder="0999999999" value={form.phone} onChange={change} className={errors.phone ? "input-error" : ""}/>
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
          <label>Plan de seguridad
            <select name="planId" value={form.planId} onChange={change} className={errors.planId ? "input-error" : ""}>
              <option value="">Selecciona un plan</option>
              {plans.map(plan => <option value={plan.id} key={plan.id}>{plan.name}{plan.price != null ? ` — $${Number(plan.price).toFixed(2)}` : ""}</option>)}
            </select>
            {errors.planId && <span className="field-error">{errors.planId}</span>}
          </label>
          <label>Tipo de propiedad
            <select name="propertyType" value={form.propertyType} onChange={change}>
              <option value="house">Casa</option><option value="apartment">Departamento</option><option value="business">Negocio</option><option value="office">Oficina</option>
            </select>
          </label>
          <label>Dirección de instalación
            <input name="address" placeholder="Ciudad, sector, calle y referencia" value={form.address} onChange={change} className={errors.address ? "input-error" : ""}/>
            {errors.address && <span className="field-error">{errors.address}</span>}
          </label>
          <label>Información adicional <small className="password-help">(opcional)</small>
            <textarea name="notes" placeholder="Cuéntanos detalles del espacio o el horario de contacto" value={form.notes} onChange={change}/>
          </label>
          {message && <p className="auth-message" role="alert">{message}</p>}
          <button type="submit" disabled={saving}>{saving ? "Guardando solicitud..." : "Finalizar y ver mi panel"}</button>
        </form>
      </section>
    </main>
  );
}

export default ServiceRequestPage;
