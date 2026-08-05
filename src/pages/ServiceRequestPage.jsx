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
    petCount: "0",
    petSize: "none",
    householdMembers: "1",
    under13Count: "0",
    notes: "",
    acceptsTerms: false,
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
          supabase.from("service_plans").select("id,name").order("id"),
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
    const { name, value, type, checked } = event.target;
    const cleanValue = type === "checkbox" ? checked : name === "phone" ? value.replace(/\D/g, "").slice(0, 10) : value;
    setForm(previous => ({ ...previous, [name]: cleanValue }));
    setErrors(previous => ({
      ...previous,
      [name]: "",
      ...(name === "householdMembers" ? {
        under13Count: Number(form.under13Count) > Number(cleanValue)
          ? "Los menores no pueden superar el total de integrantes."
          : "",
      } : {}),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!/^09\d{8}$/.test(form.phone)) nextErrors.phone = "Ingresa un celular ecuatoriano válido de 10 dígitos.";
    if (!form.planId) nextErrors.planId = "Selecciona un plan.";
    if (form.address.trim().length < 8) nextErrors.address = "Escribe una dirección más completa.";
    if (Number(form.householdMembers) < 1) nextErrors.householdMembers = "Debe existir al menos un integrante.";
    if (Number(form.under13Count) > Number(form.householdMembers)) nextErrors.under13Count = "Los menores no pueden superar el total de integrantes.";
    if (!form.acceptsTerms) nextErrors.acceptsTerms = "Debes aceptar los términos y la permanencia mínima de 4 meses.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Revisa los campos marcados antes de continuar.");
      return;
    }

    setSaving(true);
    setMessage("");
    const { error: termsError } = await supabase.auth.updateUser({
      data: { terms_accepted_at: new Date().toISOString(), minimum_term_months: 4 },
    });
    if (termsError) {
      setMessage(`No se pudo registrar la aceptación de términos: ${termsError.message}`);
      setSaving(false);
      return;
    }
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
      notes: [
        "DATOS DEL HOGAR",
        `Integrantes del hogar: ${form.householdMembers}`,
        `Menores de 13 años: ${form.under13Count}`,
        `Mascotas: ${form.petCount}`,
        `Tamaño de mascotas: ${{ none: "No tiene", small: "Pequeño", medium: "Mediano", large: "Grande", mixed: "Varios tamaños" }[form.petSize]}`,
        form.notes.trim() ? `Información adicional: ${form.notes.trim()}` : "",
      ].filter(Boolean).join("\n"),
      status: "pending",
    });
    if (error) {
      setMessage(`No se pudo guardar la solicitud: ${error.message}`);
      setSaving(false);
      return;
    }
    navigate("/disena-tu-sistema", { replace: true });
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
            <input name="phone" inputMode="numeric" maxLength={10} placeholder="Teléfono" value={form.phone} onChange={change} className={errors.phone ? "input-error" : ""}/>
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
          <label>Plan de seguridad
            <select name="planId" value={form.planId} onChange={change} className={errors.planId ? "input-error" : ""}>
              <option value="">Selecciona un plan</option>
              {plans.map(plan => <option value={plan.id} key={plan.id}>{plan.name}</option>)}
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
          <fieldset className="household-fields">
            <legend>Personas y mascotas en el hogar</legend>
            <div>
              <label>Integrantes del hogar
                <input type="number" name="householdMembers" min="1" max="30" value={form.householdMembers} onChange={change} className={errors.householdMembers ? "input-error" : ""}/>
                {errors.householdMembers && <span className="field-error">{errors.householdMembers}</span>}
              </label>
              <label>Menores de 13 años
                <input type="number" name="under13Count" min="0" max="30" value={form.under13Count} onChange={change} className={errors.under13Count ? "input-error" : ""}/>
                {errors.under13Count && <span className="field-error">{errors.under13Count}</span>}
              </label>
              <label>Cantidad de mascotas
                <input type="number" name="petCount" min="0" max="20" value={form.petCount} onChange={change}/>
              </label>
              <label>Tamaño de las mascotas
                <select name="petSize" value={form.petSize} onChange={change}>
                  <option value="none">No tiene mascotas</option><option value="small">Pequeño</option><option value="medium">Mediano</option><option value="large">Grande</option><option value="mixed">Varios tamaños</option>
                </select>
              </label>
            </div>
            <small>Esto ayuda a calibrar los sensores y reducir falsas alarmas.</small>
          </fieldset>
          <label>Información adicional <small className="password-help">(opcional)</small>
            <textarea name="notes" placeholder="Cuéntanos detalles del espacio o el horario de contacto" value={form.notes} onChange={change}/>
          </label>
          <label className="terms-acceptance">
            <input type="checkbox" name="acceptsTerms" checked={form.acceptsTerms} onChange={change}/>
            <span>Acepto los <Link to="/terminos" target="_blank">términos y condiciones</Link> y la permanencia mínima obligatoria de 4 meses.</span>
            {errors.acceptsTerms && <span className="field-error">{errors.acceptsTerms}</span>}
          </label>
          {message && <p className="auth-message" role="alert">{message}</p>}
          <button type="submit" disabled={saving}>{saving ? "Guardando solicitud..." : "Finalizar y ver mi panel"}</button>
        </form>
      </section>
    </main>
  );
}

export default ServiceRequestPage;
