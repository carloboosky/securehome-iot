import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { getSecureCameraStreamUrl } from "../lib/secureCamera";

function normalizeCameraAddress(address) {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) return "";

  const addressWithProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedAddress)
    ? trimmedAddress
    : `http://${trimmedAddress}`;

  try {
    const parsedAddress = new URL(addressWithProtocol);
    if (!["http:", "https:"].includes(parsedAddress.protocol) || !parsedAddress.hostname) return "";
    return parsedAddress.toString();
  } catch {
    return "";
  }
}

function AdminCameraAccess({ request, onClose }) {
  const [streamUrl, setStreamUrl] = useState("");
  const [customAddress, setCustomAddress] = useState(false);
  const [code, setCode] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [authorizedCameras, setAuthorizedCameras] = useState([]);
  const [configuredCameras, setConfiguredCameras] = useState([]);
  const [activeCameraUrl, setActiveCameraUrl] = useState("");
  const [configurationMessage, setConfigurationMessage] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const cameraViewRef = useRef(null);
  const accessExpiryRef = useRef(null);

  async function loadConfiguredCameras() {
    const { data, error } = await supabase.rpc("list_configured_cameras", {
      target_request_id: request.id,
    });
    if (!error) setConfiguredCameras(data || []);
  }

  async function toggleCamera(camera) {
    setSaving(true);
    const { error } = await supabase.rpc("set_camera_active", {
      target_request_id: request.id,
      target_stream_url: camera.stream_url,
      target_is_active: !camera.is_active,
    });
    if (error) {
      setConfigurationMessage(`No se pudo cambiar el estado: ${error.message}`);
    } else {
      setConfigurationMessage(`Cámara ${camera.is_active ? "desactivada" : "activada"} correctamente.`);
      await loadConfiguredCameras();
    }
    setSaving(false);
  }

  useEffect(() => {
    let active = true;
    supabase.rpc("list_configured_cameras", { target_request_id: request.id })
      .then(({ data, error }) => {
        if (active && !error) setConfiguredCameras(data || []);
      });
    return () => { active = false; };
  }, [request.id]);

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
    const normalizedAddress = normalizeCameraAddress(streamUrl);
    if (!normalizedAddress) {
      setConfigurationMessage("Ingresa una dirección válida, por ejemplo 192.168.1.120:8080/video o https://servidor/stream.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("configure_camera_device", {
      target_request_id: request.id,
      target_stream_url: normalizedAddress,
    });
    setConfigurationMessage(error ? `No se pudo guardar: ${error.message}` : "Cámara guardada en el catálogo general y asignada a este usuario.");
    if (!error) {
      setStreamUrl("");
      setCustomAddress(false);
      await loadConfiguredCameras();
    }
    setSaving(false);
  }

  async function showAuthorizedCamera(cameraAddress) {
    setActiveCameraUrl(cameraAddress);
    try {
      setVideoUrl(await getSecureCameraStreamUrl(cameraAddress));
      setMessage("Acceso autorizado durante 5 minutos.");
    } catch (streamError) {
      setVideoUrl("");
      setMessage(`Acceso validado, pero no se pudo abrir la cámara: ${streamError.message}`);
    }
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
    const { data: cameras, error: cameraError } = await supabase.from("camera_devices")
      .select("stream_url").eq("request_id", request.id).eq("is_active", true).order("updated_at", { ascending: true });
    setAccessGranted(true);
    const availableCameras = cameras || [];
    setAuthorizedCameras(availableCameras);
    if (cameraError || availableCameras.length === 0) {
      setVideoUrl("");
      setMessage("Acceso autorizado durante 5 minutos. Este cliente todavía no tiene una dirección de cámara configurada.");
    } else {
      await showAuthorizedCamera(availableCameras[0].stream_url);
    }
    if (accessExpiryRef.current) window.clearTimeout(accessExpiryRef.current);
    accessExpiryRef.current = window.setTimeout(() => {
      setVideoUrl("");
      setAuthorizedCameras([]);
      setActiveCameraUrl("");
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
            <p>Marca las cámaras que tendrá este cliente. Las cámaras activas aparecen primero y una dirección nueva queda disponible para todos los clientes.</p>
            {configuredCameras.length > 0 && <div className="configured-camera-list">
              <b>Cámaras asignadas: {configuredCameras.filter(camera => camera.is_active).length} de {configuredCameras.length} disponibles</b>
              {configuredCameras.map((camera, index) => <button
                type="button"
                className={camera.is_active ? "active" : ""}
                disabled={saving}
                onClick={() => toggleCamera(camera)}
                key={camera.stream_url}
              >
                <span>📷</span><span><strong>{camera.is_active ? `Cámara ${index + 1}` : camera.name}</strong><small>{camera.stream_url}</small></span>
                <i aria-label={camera.is_active ? "Cámara activa" : "Cámara inactiva"}>{camera.is_active ? "✓" : ""}</i>
              </button>)}
              <small>Haz clic para asignar o quitar una cámara. Las marcadas suben automáticamente al inicio.</small>
            </div>}
            <button type="button" className="add-camera-address" onClick={() => {
              setCustomAddress(true);
              setStreamUrl("");
              setConfigurationMessage("");
            }}>＋ Agregar cámara al catálogo general</button>
            {customAddress && <label className="custom-camera-address">
              Nueva dirección para todos los clientes
              <input autoFocus type="text" inputMode="url" placeholder="192.168.1.120:8080/video" value={streamUrl} onChange={event => setStreamUrl(event.target.value)}/>
              <small>Admite direcciones HTTP o HTTPS. Si omites el protocolo, se usará HTTP.</small>
            </label>}
            {customAddress && <button type="button" onClick={configure} disabled={saving || !streamUrl.trim()}>Guardar y asignar cámara</button>}
            {configurationMessage && <p className="appointment-message" role="status">{configurationMessage}</p>}
          </article>
          <article>
            <h3>2. Solicitar acceso al cliente</h3>
            <p>Envía una solicitud urgente. El cliente recibirá un código nuevo que caduca en 5 minutos.</p>
            <button type="button" className="request-camera-code" onClick={requestAccess} disabled={saving}>Solicitar código al cliente</button>
            <p>Cuando el cliente te comparta el código, ingrésalo aquí:</p>
            <div className="access-code-form"><input inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0,6))}/><button type="button" onClick={redeem} disabled={saving}>Validar código</button></div>
          </article>
          {message && <p className="appointment-message">{message}</p>}
          {accessGranted && authorizedCameras.length > 1 && <div className="camera-switcher" aria-label="Cámaras del cliente">
            {authorizedCameras.map((camera, index) => <button
              type="button"
              className={activeCameraUrl === camera.stream_url ? "selected" : ""}
              onClick={() => showAuthorizedCamera(camera.stream_url)}
              key={camera.stream_url}
            >Cámara {index + 1}</button>)}
          </div>}
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
