import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import conceptsImage from "../assets/camera-design-concepts.png";

const models = [
  { id: "modular", name: "ESP32 Modular V3", position: "0% 0%", description: "Carcasa modular con soporte orientable y espacio para lente M12.", features: ["Incluida en el precio", "Soporte orientable", "Diseño modular"], included: true },
  { id: "house", name: "Casa Protectora", position: "50% 0%", description: "Diseño decorativo en forma de casa para interiores y entradas cubiertas.", features: ["Incluida en el precio", "Diseño decorativo", "Montaje en pared"], included: true },
  { id: "spider", name: "Araña Robótica", position: "100% 0%", description: "Modelo articulado de seis patas con apariencia robótica y fabricación avanzada.", features: ["Diseño premium", "Seis patas articuladas", "Mayor tiempo de impresión"], price: 85 },
  { id: "outlet", name: "Cámara de Enchufe", position: "0% 100%", description: "Carcasa compacta para instalar junto a una toma eléctrica.", features: ["Incluida en el precio", "Formato discreto", "Instalación compacta"], included: true },
  { id: "desktop", name: "ESP32 de Escritorio", position: "50% 100%", description: "Base estable para mesa, repisa u oficina con acceso sencillo al módulo.", features: ["Incluida en el precio", "Base estable", "Fácil mantenimiento"], included: true },
];

const colors = [
  { id: "white", name: "Blanco", value: "#f4f5f7" },
  { id: "black", name: "Negro", value: "#171b22" },
  { id: "gray", name: "Gris", value: "#7d8794" },
  { id: "blue", name: "Azul", value: "#246bfd" },
];

function SystemDesignPage() {
  const navigate = useNavigate();
  const [selectedModel, setSelectedModel] = useState("modular");
  const [selectedColor, setSelectedColor] = useState("white");
  const [mountType, setMountType] = useState("wall");
  const [notes, setNotes] = useState("");
  const [requestId, setRequestId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSelection() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      const { data: request, error: requestError } = await supabase.from("service_requests")
        .select("id").eq("client_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (requestError || !request) {
        setMessage(requestError ? requestError.message : "Primero completa tu solicitud de instalación.");
        setLoading(false);
        return;
      }
      setRequestId(request.id);
      const { data } = await supabase.from("camera_design_selections")
        .select("model,color,mount_type,notes").eq("request_id", request.id).maybeSingle();
      if (data) {
        setSelectedModel(models.some(model => model.id === data.model) ? data.model : "modular");
        setSelectedColor(data.color);
        setMountType(data.mount_type);
        setNotes(data.notes || "");
      }
      setLoading(false);
    }
    loadSelection();
  }, [navigate]);

  async function saveDesign() {
    if (!requestId) return;
    setSaving(true);
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("camera_design_selections").upsert({
      request_id: requestId,
      client_id: user.id,
      model: selectedModel,
      color: selectedColor,
      mount_type: mountType,
      notes: notes.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "request_id" });
    if (error) {
      setMessage(`No se pudo guardar el diseño: ${error.message}`);
      setSaving(false);
      return;
    }
    navigate("/dashboard", { replace: true });
  }

  if (loading) return <main className="dashboard-loading-container"><div className="dashboard-loader"/><p>Preparando el diseñador…</p></main>;

  return <main className="design-page">
    <header className="design-header">
      <Link className="auth-brand" to="/"><span className="brand-mark">S</span><span>SecureHome</span></Link>
      <span>Paso final · Personalización</span>
      <h1>Diseña tu sistema de seguridad</h1>
      <p>Elige la carcasa que fabricaremos en impresión 3D para tu cámara. Podrás cambiar esta selección antes de la instalación.</p>
    </header>

    <section className="design-content">
      <div className="camera-model-grid">
        {models.map(model => <button type="button" className={`camera-model-card ${selectedModel === model.id ? "selected" : ""}`} onClick={() => setSelectedModel(model.id)} key={model.id}>
          <span className="camera-concept-image" style={{ backgroundImage: `url(${conceptsImage})`, backgroundPosition: model.position }}/>
          <span className="model-copy"><i>{selectedModel === model.id ? "✓ Seleccionado" : "Seleccionar"}</i><strong>{model.name}</strong><small>{model.description}</small><b className={model.price ? "model-price premium" : "model-price"}>{model.price ? `+$${model.price}` : "Incluida en el precio"}</b></span>
          <span className="model-features">{model.features.map(feature => <em key={feature}>✓ {feature}</em>)}</span>
        </button>)}
      </div>

      <aside className="design-options">
        <span className="form-step">Tu configuración</span>
        <h2>{models.find(model => model.id === selectedModel)?.name}</h2>
        <p className={`design-price-summary ${selectedModel === "spider" ? "premium" : ""}`}>{selectedModel === "spider" ? "Recargo del diseño: +$85" : "Este diseño está incluido en el precio"}</p>
        <div className="design-field"><b>Color de impresión</b><div className="color-picker">{colors.map(color => <button type="button" className={selectedColor === color.id ? "selected" : ""} onClick={() => setSelectedColor(color.id)} key={color.id}><i style={{ background: color.value }}/><span>{color.name}</span></button>)}</div></div>
        <label className="design-field"><b>Tipo de montaje</b><select value={mountType} onChange={event => setMountType(event.target.value)}><option value="wall">Pared</option><option value="ceiling">Techo</option><option value="table">Mesa o repisa</option><option value="corner">Esquina</option></select></label>
        <label className="design-field"><b>Indicaciones para fabricación</b><textarea maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ejemplo: necesito ocultar el cable hacia el lado derecho…"/></label>
        {message && <p className="auth-message" role="alert">{message}</p>}
        <button type="button" className="confirm-design-button" onClick={saveDesign} disabled={saving || !requestId}>{saving ? "Guardando diseño…" : "Confirmar mi diseño →"}</button>
        <small>La selección es una preferencia inicial. Las medidas finales se confirmarán durante la visita técnica.</small>
      </aside>
    </section>
  </main>;
}

export default SystemDesignPage;
