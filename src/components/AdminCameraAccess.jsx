import { useState } from "react";
import { supabase } from "../lib/supabase";

function AdminCameraAccess({ request, onClose }) {
  const [streamUrl, setStreamUrl] = useState("");
  const [code, setCode] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function configure() {
    if (!/^https:\/\//i.test(streamUrl.trim())) {
      setMessage("La transmisión debe utilizar una dirección HTTPS segura.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("camera_devices").upsert({
      request_id: request.id,
      stream_url: streamUrl.trim(),
      configured_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "request_id" });
    setMessage(error ? `No se pudo configurar: ${error.message}` : "Cámara configurada. La dirección permanece protegida.");
    if (!error) setStreamUrl("");
    setSaving(false);
  }

  async function redeem() {
    if (!/^\d{6}$/.test(code)) {
      setMessage("Ingresa el código de 6 números entregado por el cliente.");
      return;
    }
    setSaving(true);
    const { data: allowed, error } = await supabase.rpc("redeem_camera_access_code", {
      target_request_id: request.id,
      plain_code: code,
    });
    if (error || !allowed) {
      setMessage("El código es incorrecto, ya fue usado o caducó.");
      setSaving(false);
      return;
    }
    const { data: camera, error: cameraError } = await supabase.from("camera_devices")
      .select("stream_url").eq("request_id", request.id).maybeSingle();
    if (cameraError || !camera) setMessage("No hay una cámara configurada para esta solicitud.");
    else {
      setVideoUrl(camera.stream_url);
      setMessage("Acceso autorizado durante 30 minutos.");
      window.setTimeout(() => {
        setVideoUrl("");
        setMessage("El permiso temporal para ver la cámara ha caducado.");
      }, 30 * 60 * 1000);
    }
    setSaving(false);
  }

  return (
    <div className="chat-modal-backdrop">
      <section className="camera-admin-modal" role="dialog" aria-modal="true" aria-label="Acceso administrativo a cámara">
        <div className="chat-modal-title"><div><b>Cámara de {request.profiles?.full_name || "cliente"}</b><span>Configuración y acceso temporal</span></div><button type="button" onClick={onClose}>×</button></div>
        <div className="camera-admin-body">
          <article>
            <h3>1. Configurar cámara</h3>
            <p>Esta dirección solamente queda disponible para el propietario y para administradores con permiso temporal.</p>
            <input type="url" placeholder="https://servidor-seguro/transmision" value={streamUrl} onChange={event => setStreamUrl(event.target.value)}/>
            <button type="button" onClick={configure} disabled={saving}>Guardar dirección segura</button>
          </article>
          <article>
            <h3>2. Solicitar acceso al cliente</h3>
            <p>Pide al cliente el código temporal de seis números generado en su dashboard.</p>
            <div className="access-code-form"><input inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0,6))}/><button type="button" onClick={redeem} disabled={saving}>Validar código</button></div>
          </article>
          {message && <p className="appointment-message">{message}</p>}
          {videoUrl && <div className="admin-camera-view"><img src={videoUrl} alt="Transmisión temporal autorizada por el cliente"/></div>}
        </div>
      </section>
    </div>
  );
}

export default AdminCameraAccess;
