import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { getSecureCameraStreamUrl } from "../lib/secureCamera";

const defaultCameraCatalog = [
  { name: "Cámara principal AWS", stream_url: "https://iot-security.pro/api/camera/stream", is_active: false, is_default: true, is_persisted: true },
  { name: "Cámara AWS 2", stream_url: "https://iot-security.pro/api/camera/stream2", is_active: false, is_default: true, is_persisted: true },
  { name: "Cámara IP 3", stream_url: "https://192.168.1.101:8080/stream", is_active: false, is_default: true, is_persisted: true },
  { name: "Cámara IP 4", stream_url: "https://192.168.1.102:8080/stream", is_active: false, is_default: true, is_persisted: true },
  { name: "Cámara IP 5", stream_url: "https://10.0.0.25:8081/video", is_active: false, is_default: true, is_persisted: true },
];

function mergeCameraCatalog(savedCameras = []) {
  const camerasByUrl = new Map(defaultCameraCatalog.map(camera => [camera.stream_url, camera]));
  savedCameras.forEach(camera => {
    camerasByUrl.set(camera.stream_url, { ...camerasByUrl.get(camera.stream_url), ...camera, is_persisted: true });
  });
  return [...camerasByUrl.values()].sort((first, second) => Number(second.is_active) - Number(first.is_active));
}

function sortActiveCamerasFirst(cameras) {
  return [...cameras].sort((first, second) => Number(second.is_active) - Number(first.is_active));
}

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

  function toggleCamera(camera) {
    const nextActiveState = !camera.is_active;
    setConfiguredCameras(sortActiveCamerasFirst(configuredCameras.map(item => (
      item.stream_url === camera.stream_url ? { ...item, is_active: nextActiveState } : item
    ))));
    setConfigurationMessage("Selección modificada. Pulsa Guardar cámaras seleccionadas para confirmar.");
  }

  async function saveCameraSelection() {
    setSaving(true);
    const selectedUrls = configuredCameras.filter(camera => camera.is_active).map(camera => camera.stream_url);
    const { error } = await supabase.rpc("save_camera_assignments", {
      target_request_id: request.id,
      active_stream_urls: selectedUrls,
    });
    setConfigurationMessage(error
      ? `No se pudo guardar la selección: ${error.message}`
      : `${selectedUrls.length} cámara(s) guardada(s) para este cliente.`);
    if (!error) {
      setConfiguredCameras(current => current.map(camera => (
        camera.is_active ? { ...camera, is_persisted: true } : camera
      )));
    }
    setSaving(false);
  }

  async function deleteCamera(camera) {
    const confirmationDetail = camera.is_persisted
      ? "La dirección se quitará del catálogo general y de todos los clientes."
      : "La dirección nueva se descartará de esta selección.";
    if (!window.confirm(`¿Eliminar ${camera.name}?\n\n${confirmationDetail}`)) return;
    if (!camera.is_persisted) {
      setConfiguredCameras(current => current.filter(item => item.stream_url !== camera.stream_url));
      setConfigurationMessage("Dirección nueva descartada correctamente.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("delete_camera_from_catalog", {
      target_stream_url: camera.stream_url,
    });
    if (error) {
      setConfigurationMessage(`No se pudo eliminar: ${error.message}`);
    } else {
      setConfiguredCameras(current => current.filter(item => item.stream_url !== camera.stream_url));
      setConfigurationMessage("Dirección de cámara eliminada correctamente.");
    }
    setSaving(false);
  }

  useEffect(() => {
    let active = true;
    supabase.rpc("list_configured_cameras", { target_request_id: request.id })
      .then(({ data, error }) => {
        if (active) setConfiguredCameras(mergeCameraCatalog(error ? [] : data));
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
    setConfiguredCameras(current => sortActiveCamerasFirst([
      ...current.filter(camera => camera.stream_url !== normalizedAddress),
      { name: "Cámara nueva", stream_url: normalizedAddress, is_active: true, is_persisted: false },
    ]));
    setStreamUrl("");
    setCustomAddress(false);
    setConfigurationMessage("Cámara añadida a la selección. Pulsa Guardar cámaras seleccionadas para confirmar.");
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
              {configuredCameras.map(camera => <div className="configured-camera-row" key={camera.stream_url}>
                <button
                  type="button"
                  className={camera.is_active ? "active" : ""}
                  onClick={() => toggleCamera(camera)}
                >
                  <span>📷</span><span><strong>{camera.name}</strong><small>{camera.stream_url}</small></span>
                  <i aria-label={camera.is_active ? "Cámara activa" : "Cámara inactiva"}>{camera.is_active ? "✓" : ""}</i>
                </button>
                {!camera.is_default && <button type="button" className="delete-camera-address" onClick={() => deleteCamera(camera)} disabled={saving} aria-label={`Eliminar ${camera.name}`}>🗑</button>}
              </div>)}
              <small>Haz clic para asignar o quitar una cámara. Las marcadas suben automáticamente al inicio.</small>
            </div>}
            <button type="button" className="save-camera-selection" onClick={saveCameraSelection} disabled={saving}>
              {saving ? "Guardando selección…" : "Guardar cámaras seleccionadas"}
            </button>
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
            {customAddress && <button type="button" onClick={configure} disabled={!streamUrl.trim()}>Añadir a la selección</button>}
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
