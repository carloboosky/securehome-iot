import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { getSecureCameraStreamUrl, PRIMARY_CAMERA_STREAM_URL } from "../lib/secureCamera";

const cameraAddressOptions = [
  { name: "Cámara principal AWS", url: PRIMARY_CAMERA_STREAM_URL, verified: true },
  { name: "Cámara IP 2", url: "https://192.168.1.101:8080/stream" },
  { name: "Cámara IP 3", url: "https://192.168.1.102:8080/stream" },
  { name: "Cámara IP 4", url: "https://10.0.0.25:8081/video" },
  { name: "Cámara IP 5", url: "https://camera-local.example/live.mjpg" },
];

function AdminCameraAccess({ request, onClose }) {
  const [streamUrl, setStreamUrl] = useState("");
  const [customAddress, setCustomAddress] = useState(false);
  const [code, setCode] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const cameraViewRef = useRef(null);
  const accessExpiryRef = useRef(null);

  useEffect(() => () => {
    if (accessExpiryRef.current) window.clearTimeout(accessExpiryRef.current);
  }, []);

  async function openFullscreen() {
    try {
      await cameraViewRef.current?.requestFullscreen();
    } catch {
      setMessage("El navegador no permitió abrir la cámara en pantalla completa.");
    }
  }

  async function requestAccess() {
    setSaving(true);
    const { data, error } = await supabase.rpc("request_camera_access", {
      target_request_id: request.id,
    });
    if (error || !data) setMessage(`No se pudo solicitar acceso: ${error?.message || "Error desconocido"}`);
    else setMessage("Solicitud enviada. El cliente recibió un código urgente que caduca en 5 minutos.");
    setSaving(false);
  }

  async function configure() {
    if (!/^https:\/\//i.test(streamUrl.trim())) {
      setMessage("La transmisión debe utilizar una dirección HTTPS segura.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("configure_camera_device", {
      target_request_id: request.id,
      target_stream_url: streamUrl.trim(),
    });
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
      setMessage(
        error
          ? `No se pudo validar el código: ${error.message}`
          : "El código es incorrecto, ya fue usado, fue reemplazado o caducó."
      );
      setSaving(false);
      return;
    }
    const { data: camera, error: cameraError } = await supabase.from("camera_devices")
      .select("stream_url").eq("request_id", request.id).maybeSingle();
    setAccessGranted(true);
    if (cameraError || !camera?.stream_url) {
      setVideoUrl("");
      setMessage("Acceso autorizado durante 5 minutos. Este cliente todavía no tiene una dirección de cámara configurada.");
    } else {
      try {
        setVideoUrl(await getSecureCameraStreamUrl(camera.stream_url));
        setMessage("Acceso autorizado durante 5 minutos.");
      } catch (streamError) {
        setVideoUrl("");
        setMessage(`Acceso validado, pero no se pudo abrir la cámara: ${streamError.message}`);
      }
    }
    if (accessExpiryRef.current) window.clearTimeout(accessExpiryRef.current);
    accessExpiryRef.current = window.setTimeout(() => {
      setVideoUrl("");
      setAccessGranted(false);
      setMessage("El permiso temporal para ver la cámara ha caducado.");
    }, 5 * 60 * 1000);
    setSaving(false);
  }

  return (
    <div className="chat-modal-backdrop">
      <section className="camera-admin-modal" role="dialog" aria-modal="true" aria-label="Acceso administrativo a cámara">
        <div className="chat-modal-title"><div><b>Cámara de {request.profiles?.full_name || "cliente"}</b><span>Configuración y acceso temporal</span></div><button type="button" onClick={onClose}>×</button></div>
        <div className="camera-admin-body">
          <article>
            <h3>1. Configurar cámara</h3>
            <p>Selecciona una dirección para este cliente. Solamente la opción con el visto verde está comprobada.</p>
            <div className="camera-address-options">
              {cameraAddressOptions.map(option => {
                const selected = !customAddress && streamUrl === option.url;
                return <button
                  type="button"
                  className={`camera-address-option ${selected ? "selected" : ""}`}
                  onClick={() => {
                    setCustomAddress(false);
                    setStreamUrl(option.url);
                    setMessage("");
                  }}
                  key={option.url}
                >
                  <span className="camera-address-icon">📡</span>
                  <span><b>{option.name}</b><small>{option.url}</small></span>
                  {option.verified ? <i className="verified-address" title="Dirección verificada">✓</i> : <i className="sample-address">Ejemplo</i>}
                </button>;
              })}
            </div>
            <button type="button" className="add-camera-address" onClick={() => {
              setCustomAddress(true);
              setStreamUrl("");
              setMessage("");
            }}>＋ Agregar una nueva dirección</button>
            {customAddress && <label className="custom-camera-address">
              Nueva dirección de cámara
              <input autoFocus type="url" placeholder="https://servidor-seguro/transmision" value={streamUrl} onChange={event => setStreamUrl(event.target.value)}/>
            </label>}
            <button type="button" onClick={configure} disabled={saving || !streamUrl.trim()}>Guardar dirección seleccionada</button>
          </article>
          <article>
            <h3>2. Solicitar acceso al cliente</h3>
            <p>Envía una solicitud urgente. El cliente recibirá un código nuevo que caduca en 5 minutos.</p>
            <button type="button" className="request-camera-code" onClick={requestAccess} disabled={saving}>Solicitar código al cliente</button>
            <p>Cuando el cliente te comparta el código, ingrésalo aquí:</p>
            <div className="access-code-form"><input inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0,6))}/><button type="button" onClick={redeem} disabled={saving}>Validar código</button></div>
          </article>
          {message && <p className="appointment-message">{message}</p>}
          {videoUrl && <div className="admin-camera-view" ref={cameraViewRef}>
            <button type="button" className="fullscreen-button admin-fullscreen-button" onClick={openFullscreen}>⛶ Pantalla completa</button>
            <img crossOrigin="anonymous" src={videoUrl} alt="Transmisión temporal autorizada por el cliente" onError={() => setMessage("El acceso está autorizado, pero el stream de AWS no está disponible en este momento.")}/>
          </div>}
          {accessGranted && !videoUrl && <div className="admin-camera-view empty"><div><span>📷</span><b>Acceso autorizado</b><p>Cámara pendiente de configuración o conexión.</p></div></div>}
        </div>
      </section>
    </div>
  );
}

export default AdminCameraAccess;
