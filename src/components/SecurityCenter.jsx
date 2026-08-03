import { useEffect, useRef, useState } from "react";
import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";
import { supabase } from "../lib/supabase";
import { getSecureCameraStreamUrl } from "../lib/secureCamera";

const ALERTS_URL = "https://iot-security.pro/api/alerts";
const ALERT_COOLDOWN_MS = 30_000;
const STREAM_TOKEN_REFRESH_MS = 9 * 60 * 1000;
const DETECTION_INTERVAL_MS = 500;
const DETECTION_MAX_WIDTH = 512;

const days = [
  ["lun", "Lun"], ["mar", "Mar"], ["mie", "Mié"], ["jue", "Jue"],
  ["vie", "Vie"], ["sab", "Sáb"], ["dom", "Dom"],
];

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 ? "30" : "00";
  return `${hours}:${minutes}`;
});

function normalizeTime(value, fallback) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) return fallback;
  const [hours, minutes] = value.split(":").map(Number);
  const roundedSlots = Math.round((hours * 60 + minutes) / 30) % 48;
  return timeOptions[roundedSlots];
}

const defaultConfig = {
  armed: false,
  nfcDoor: false,
  telegram: false,
  mode: "always",
  days: ["lun", "mar", "mie", "jue", "vie", "sab", "dom"],
  start: "20:00",
  end: "07:00",
};

function SecurityCenter({ requestId }) {
  const storageKey = `securehome-config-${requestId}`;
  const [config, setConfig] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey)) || {};
      return {
        ...defaultConfig,
        ...stored,
        start: normalizeTime(stored.start, defaultConfig.start),
        end: normalizeTime(stored.end, defaultConfig.end),
      };
    } catch {
      return defaultConfig;
    }
  });
  const [configuredCameraUrl, setConfiguredCameraUrl] = useState("");
  const [configuredCameras, setConfiguredCameras] = useState([]);
  const [cameraUrl, setCameraUrl] = useState("");
  const [cameraOnline, setCameraOnline] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(() => ({
    mode: config.mode,
    days: config.days,
    start: config.start,
    end: config.end,
  }));
  const [accessCode, setAccessCode] = useState("");
  const [accessExpires, setAccessExpires] = useState("");
  const [urgentDismissed, setUrgentDismissed] = useState(false);
  const [notice, setNotice] = useState("");
  const [sounding, setSounding] = useState(false);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const cameraPanelRef = useRef(null);
  const detectorRef = useRef(null);
  const animationFrameRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const lastAlertAtRef = useRef(0);
  const lastDetectionAtRef = useRef(0);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, [config, storageKey]);

  useEffect(() => {
    let active = true;

    supabase
      .from("camera_devices")
      .select("stream_url")
      .eq("request_id", requestId)
      .order("updated_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setNotice("No se pudo cargar la dirección configurada de la cámara.");
          return;
        }
        const cameras = data || [];
        const savedStreamUrl = cameras[0]?.stream_url || "";
        setConfiguredCameras(cameras);
        setConfiguredCameraUrl(savedStreamUrl);
        if (!savedStreamUrl) setCameraUrl("");
      });

    return () => {
      active = false;
    };
  }, [requestId]);

  useEffect(() => {
    if (!configuredCameraUrl) {
      return undefined;
    }

    let active = true;
    let refreshTimer;

    async function refreshStreamToken() {
      try {
        const secureUrl = await getSecureCameraStreamUrl(configuredCameraUrl);
        if (!active) return;
        setCameraUrl(secureUrl);
        setNotice("");
        refreshTimer = window.setTimeout(refreshStreamToken, STREAM_TOKEN_REFRESH_MS);
      } catch (error) {
        if (!active) return;
        setCameraOnline(false);
        setCameraUrl("");
        setNotice(error.message);
      }
    }

    refreshStreamToken();
    return () => {
      active = false;
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [configuredCameraUrl]);

  useEffect(() => {
    let cancelled = false;

    async function initializeDetector() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        const detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite",
            delegate: "GPU",
          },
          scoreThreshold: 0.60,
          runningMode: "IMAGE",
        });

        if (cancelled) {
          detector.close();
          return;
        }

        detectorRef.current = detector;
        analysisCanvasRef.current = document.createElement("canvas");

        function detectFrame(timestamp) {
          if (cancelled) return;

          const image = imgRef.current;
          const canvas = canvasRef.current;
          const activeDetector = detectorRef.current;

          if (timestamp - lastDetectionAtRef.current < DETECTION_INTERVAL_MS) {
            animationFrameRef.current = window.requestAnimationFrame(detectFrame);
            return;
          }
          lastDetectionAtRef.current = timestamp;

          if (image?.complete && image.naturalWidth > 0 && canvas && activeDetector) {
            const analysisCanvas = analysisCanvasRef.current;
            const displayWidth = image.clientWidth;
            const displayHeight = image.clientHeight;
            const pixelRatio = window.devicePixelRatio || 1;
            const targetWidth = Math.round(displayWidth * pixelRatio);
            const targetHeight = Math.round(displayHeight * pixelRatio);

            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
              canvas.width = targetWidth;
              canvas.height = targetHeight;
            }

            const context = canvas.getContext("2d");
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            context.clearRect(0, 0, displayWidth, displayHeight);

            try {
              const analysisScale = Math.min(1, DETECTION_MAX_WIDTH / image.naturalWidth);
              analysisCanvas.width = Math.max(1, Math.round(image.naturalWidth * analysisScale));
              analysisCanvas.height = Math.max(1, Math.round(image.naturalHeight * analysisScale));
              analysisCanvas.getContext("2d", { alpha: false }).drawImage(
                image,
                0,
                0,
                analysisCanvas.width,
                analysisCanvas.height
              );

              const { detections = [] } = activeDetector.detect(analysisCanvas);
              const imageScale = Math.min(
                displayWidth / analysisCanvas.width,
                displayHeight / analysisCanvas.height
              );
              const renderedWidth = analysisCanvas.width * imageScale;
              const renderedHeight = analysisCanvas.height * imageScale;
              const offsetX = (displayWidth - renderedWidth) / 2;
              const offsetY = (displayHeight - renderedHeight) / 2;

              detections.forEach(detection => {
                const box = detection.boundingBox;
                const category = detection.categories?.[0];
                if (!box || !category) return;

                const x = offsetX + box.originX * imageScale;
                const y = offsetY + box.originY * imageScale;
                const width = box.width * imageScale;
                const height = box.height * imageScale;
                const label = `${category.categoryName} ${Math.round(category.score * 100)}%`;

                context.strokeStyle = category.categoryName === "person" ? "#ff3b4f" : "#26d6a9";
                context.fillStyle = context.strokeStyle;
                context.lineWidth = 3;
                context.font = "bold 14px sans-serif";
                context.strokeRect(x, y, width, height);
                const labelWidth = context.measureText(label).width + 12;
                context.fillRect(x, Math.max(0, y - 24), labelWidth, 24);
                context.fillStyle = "#ffffff";
                context.fillText(label, x + 6, Math.max(17, y - 7));

                const now = Date.now();
                if (
                  category.categoryName === "person"
                  && category.score > 0.70
                  && now - lastAlertAtRef.current >= ALERT_COOLDOWN_MS
                ) {
                  lastAlertAtRef.current = now;
                  fetch(ALERTS_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      message: "🚨 INTRUSIÓN: Persona detectada en el stream",
                      confidence: Math.round(category.score * 100),
                      tipo_evento: "Persona",
                    }),
                  }).catch(error => console.error("No se pudo enviar la alerta:", error));
                }
              });
            } catch (error) {
              console.error("No se pudo analizar el fotograma de la cámara:", error);
            }
          }

          animationFrameRef.current = window.requestAnimationFrame(detectFrame);
        }

        animationFrameRef.current = window.requestAnimationFrame(detectFrame);
      } catch (error) {
        console.error("No se pudo iniciar MediaPipe:", error);
        if (!cancelled) setNotice("No se pudo iniciar el detector de personas en este navegador.");
      }
    }

    initializeDetector();

    return () => {
      cancelled = true;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
      detectorRef.current?.close();
      detectorRef.current = null;
      analysisCanvasRef.current = null;
      animationFrameRef.current = null;
      retryTimeoutRef.current = null;
    };
  }, []);

  function retryCameraStream() {
    setCameraOnline(false);
    setNotice("La cámara perdió la conexión. Reintentando en 3 segundos...");
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
    }
    retryTimeoutRef.current = window.setTimeout(() => {
      getSecureCameraStreamUrl(configuredCameraUrl)
        .then(secureUrl => {
          const retryUrl = new URL(secureUrl);
          retryUrl.searchParams.set("t", Date.now().toString());
          setCameraUrl(retryUrl.toString());
        })
        .catch(error => setNotice(error.message));
      retryTimeoutRef.current = null;
    }, 3000);
  }

  async function openCameraFullscreen() {
    try {
      await cameraPanelRef.current?.requestFullscreen();
    } catch {
      setNotice("El navegador no permitió abrir la cámara en pantalla completa.");
    }
  }

  useEffect(() => {
    function receiveCode(code) {
      if (!code?.display_code) return;
      setAccessCode(code.display_code);
      setAccessExpires(code.expires_at);
      setUrgentDismissed(false);
      setNotice("El administrador solicita acceso temporal a tu cámara.");
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Solicitud urgente de acceso", {
          body: `Código temporal: ${code.display_code}. Caduca en 5 minutos.`,
        });
      }
    }

    supabase.from("camera_access_codes")
      .select("display_code,expires_at")
      .eq("request_id", requestId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => receiveCode(data));

    const channel = supabase.channel(`camera-code-${requestId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "camera_access_codes",
        filter: `request_id=eq.${requestId}`,
      }, payload => receiveCode(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId]);

  useEffect(() => {
    if (!accessExpires) return undefined;
    const remaining = new Date(accessExpires).getTime() - Date.now();
    const timer = window.setTimeout(() => {
      setAccessCode("");
      setAccessExpires("");
      setNotice("La solicitud de acceso caducó. El administrador deberá pedir un código nuevo.");
    }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [accessExpires]);

  function update(key, value) {
    setConfig(previous => ({ ...previous, [key]: value }));
    setNotice("Configuración guardada en este dispositivo.");
  }

  function toggleDay(day) {
    setScheduleDraft(previous => ({
      ...previous,
      days: previous.days.includes(day)
        ? previous.days.filter(item => item !== day)
        : [...previous.days, day],
    }));
  }

  function confirmAllDay() {
    setConfig(previous => ({ ...previous, mode: "always" }));
    setNotice("Horario confirmado: el sistema protegerá tu hogar todo el día.");
  }

  function confirmCustomSchedule() {
    if (scheduleDraft.days.length === 0) {
      setNotice("Selecciona al menos un día para confirmar el horario.");
      return;
    }
    setConfig(previous => ({
      ...previous,
      mode: "custom",
      days: scheduleDraft.days,
      start: scheduleDraft.start,
      end: scheduleDraft.end,
    }));
    setNotice(`Horario personalizado confirmado: ${scheduleDraft.start} a ${scheduleDraft.end}.`);
  }

  function testAlarm() {
    setSounding(true);
    setNotice("Prueba de sirena en este dispositivo. Esto no activa todavía la sirena física.");
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      setSounding(false);
      return;
    }
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(720, context.currentTime);
    oscillator.frequency.linearRampToValueAtTime(940, context.currentTime + 1.4);
    gain.gain.setValueAtTime(.12, context.currentTime);
    gain.gain.setValueAtTime(0, context.currentTime + 1.5);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.5);
    oscillator.onended = () => {
      context.close();
      setSounding(false);
    };
  }

  return (
    <section className="security-center">
      <div className="security-heading">
        <div>
          <span className="form-step">Centro de seguridad</span>
          <h2>Control de tu sistema</h2>
          <p>Supervisa la cámara y configura la protección de tu hogar.</p>
        </div>
        <button type="button" className={`system-toggle ${config.armed ? "is-armed" : ""}`} onClick={() => update("armed", !config.armed)}>
          <span>{config.armed ? "✓" : "○"}</span>
          {config.armed ? "Sistema activado" : "Activar sistema"}
        </button>
      </div>

      {notice && <p className="control-notice" role="status">{notice}</p>}

      <div className="security-layout">
        <article className="camera-panel" ref={cameraPanelRef}>
          {configuredCameras.length > 1 && <div className="camera-switcher client-camera-switcher" aria-label="Tus cámaras">
            {configuredCameras.map((camera, index) => <button
              type="button"
              className={configuredCameraUrl === camera.stream_url ? "selected" : ""}
              onClick={() => {
                setCameraOnline(false);
                setCameraUrl("");
                setConfiguredCameraUrl(camera.stream_url);
              }}
              key={camera.stream_url}
            >Cámara {index + 1}</button>)}
          </div>}
          <div className="camera-topbar">
            <div><i className={cameraOnline ? "online" : ""}/><b>Cámara {Math.max(1, configuredCameras.findIndex(camera => camera.stream_url === configuredCameraUrl) + 1)}</b></div>
            <div className="camera-topbar-actions">
              <span>{cameraOnline ? "EN VIVO" : configuredCameraUrl ? "CONECTANDO" : "SIN CONFIGURAR"}</span>
              {configuredCameraUrl && <button type="button" className="fullscreen-button" onClick={openCameraFullscreen} aria-label="Ver cámara en pantalla completa">⛶ Pantalla completa</button>}
            </div>
          </div>
          <div className="camera-screen">
            {cameraUrl ? <>
              <img
                ref={imgRef}
                crossOrigin="anonymous"
                src={cameraUrl}
                alt="Transmisión en vivo de la cámara de seguridad"
                onLoad={() => {
                  setCameraOnline(true);
                  setNotice("");
                }}
                onError={retryCameraStream}
              />
              <canvas ref={canvasRef} aria-hidden="true" />
            </> : <div className="camera-placeholder"><span>📷</span><b>{configuredCameraUrl ? "Cargando cámara segura" : "Cámara pendiente de configuración"}</b><p>{configuredCameraUrl ? "Validando tu sesión y solicitando acceso temporal…" : "El administrador debe asignar al menos una cámara a tu solicitud."}</p></div>}
          </div>
          <div className="camera-permission">
            <div><b>Acceso temporal para soporte</b><span>El administrador debe solicitar acceso. Recibirás un código nuevo que caduca en 5 minutos.</span></div>
            <span className="waiting-access">{accessCode ? "Solicitud recibida" : "Sin solicitudes"}</span>
          </div>
        </article>

        <aside className="quick-controls">
          <article className="control-card alarm-card">
            <span className="control-icon">🚨</span>
            <div><h3>Sirena</h3><p>Prueba el sonido de alarma.</p></div>
            <button type="button" disabled={sounding} onClick={testAlarm}>{sounding ? "Sonando..." : "Sonar alarma"}</button>
          </article>
          <article className="control-card">
            <span className="control-icon">🔑</span>
            <div><h3>Alarma de puerta NFC</h3><p>Avisa cuando se abra sin una tarjeta autorizada.</p></div>
            <button type="button" className={`switch ${config.nfcDoor ? "on" : ""}`} aria-label="Activar alarma NFC" aria-pressed={config.nfcDoor} onClick={() => update("nfcDoor", !config.nfcDoor)}><span/></button>
          </article>
          <article className="control-card">
            <span className="control-icon">📱</span>
            <div><h3>Alertas de Telegram</h3><p>Envía los eventos al chat vinculado.</p></div>
            <button type="button" className={`switch ${config.telegram ? "on" : ""}`} aria-label="Activar Telegram" aria-pressed={config.telegram} onClick={() => update("telegram", !config.telegram)}><span/></button>
          </article>
          <article className="control-card">
            <span className="control-icon">📡</span>
            <div><h3>Sensores</h3><p>Los sensores se vinculan durante la instalación.</p></div>
            <span className="device-badge">Pendiente</span>
          </article>
        </aside>
      </div>
      {accessCode && !urgentDismissed && <aside className="urgent-camera-code" role="alert">
        <button type="button" className="urgent-close" aria-label="Cerrar alerta" onClick={() => setUrgentDismissed(true)}>×</button>
        <span>⚠️</span><div><b>Solicitud urgente de acceso a cámara</b><p>Comparte este código únicamente con el administrador. Caduca en 5 minutos y funciona una sola vez.</p><strong>{accessCode}</strong></div>
      </aside>}

      <article className="schedule-card">
        <div className="schedule-title"><span>🕒</span><div><h3>Horario de protección</h3><p>Decide cuándo se activará automáticamente el sistema.</p></div></div>
        <div className="mode-buttons">
          <button type="button" className={scheduleDraft.mode === "always" ? "selected" : ""} onClick={() => setScheduleDraft(previous => ({ ...previous, mode: "always" }))}><span>☀️</span><b>Todo el día</b><small>Protección continua 24/7</small></button>
          <button type="button" className={scheduleDraft.mode === "custom" ? "selected" : ""} onClick={() => setScheduleDraft(previous => ({ ...previous, mode: "custom" }))}><span>🗓️</span><b>Personalizado</b><small>Elige días y horas</small></button>
        </div>
        {scheduleDraft.mode === "always" && <div className="all-day-schedule">
          <span>🛡️</span>
          <div><b>Protección activa las 24 horas</b><p>El sistema permanecerá preparado todos los días, sin interrupciones.</p></div>
          <button type="button" onClick={confirmAllDay}>{config.mode === "always" ? "Confirmar nuevamente" : "Confirmar todo el día"}</button>
        </div>}
        {scheduleDraft.mode === "custom" && <div className="custom-schedule">
          <div className="schedule-days">
            <span>Días activos</span>
            <div className="day-picker">{days.map(([value, label]) => <button type="button" aria-label={value} className={scheduleDraft.days.includes(value) ? "selected" : ""} onClick={() => toggleDay(value)} key={value}><i>✓</i>{label}</button>)}</div>
          </div>
          <div className="time-range">
            <label><span>🌙 Hora de inicio</span><select value={scheduleDraft.start} onChange={event => setScheduleDraft(previous => ({ ...previous, start: event.target.value }))}>{timeOptions.map(time => <option value={time} key={time}>{time}</option>)}</select></label>
            <b>→</b>
            <label><span>☀️ Hora de fin</span><select value={scheduleDraft.end} onChange={event => setScheduleDraft(previous => ({ ...previous, end: event.target.value }))}>{timeOptions.map(time => <option value={time} key={time}>{time}</option>)}</select></label>
          </div>
          <p className="schedule-summary">🛡️ El sistema se activará de <strong>{scheduleDraft.start}</strong> a <strong>{scheduleDraft.end}</strong> los días seleccionados.</p>
          <button type="button" className="confirm-schedule-button" onClick={confirmCustomSchedule}>✓ Confirmar horario personalizado</button>
        </div>}
        <p className="saved-schedule">Configuración guardada: <strong>{config.mode === "always" ? "protección todo el día" : `${config.start} a ${config.end}`}</strong></p>
      </article>
      <p className="integration-note">Los ajustes se guardan en este navegador. Para controlar la cámara, sirena, NFC y Telegram físicamente, el técnico debe conectar la API del equipo instalado.</p>
    </section>
  );
}

export default SecurityCenter;
