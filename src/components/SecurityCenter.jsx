import { useEffect, useRef, useState } from "react";
import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";
import { BellRing, CalendarDays, Clock3, Maximize, Moon, Nfc, PawPrint, Phone, Radio, Send, ShieldCheck, Sun, TriangleAlert, Users, Video } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getSecureCameraStreamUrl } from "../lib/secureCamera";

const ALERTS_URL = "https://iot-security.pro/api/alerts";
const ALERT_COOLDOWN_MS = 15_000;
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
  const [secondaryCameraUrl, setSecondaryCameraUrl] = useState("");
  const [secondaryCameraOnline, setSecondaryCameraOnline] = useState(false);
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
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [residents, setResidents] = useState([]);
  const [pets, setPets] = useState([]);
  const [residentName, setResidentName] = useState("");
  const [residentRole, setResidentRole] = useState("Familiar");
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState("Perro");
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [householdMessage, setHouseholdMessage] = useState("");
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const cameraPanelRef = useRef(null);
  const detectorRef = useRef(null);
  const animationFrameRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const lastAlertAtRef = useRef(0);
  const lastDetectionAtRef = useRef(0);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
    localStorage.setItem(storageKey, JSON.stringify(config));
    localStorage.setItem("home_mode", config.armed ? "AUSENTE" : "EN_CASA");
  }, [config, storageKey]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", data.user.id)
        .maybeSingle();
      if (active) setPhone(profile?.phone || data.user.user_metadata?.phone || "");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadHousehold() {
      const [{ data: residentData, error: residentError }, { data: petData, error: petError }] = await Promise.all([
        supabase.from("residents").select("id,full_name,role,is_at_home").eq("request_id", requestId).order("created_at"),
        supabase.from("pets").select("id,name,type").eq("request_id", requestId).order("created_at"),
      ]);
      if (!active) return;
      if (residentError || petError) {
        setHouseholdMessage(`No se pudo cargar el hogar: ${residentError?.message || petError?.message}`);
      } else {
        const loadedResidents = residentData || [];
        setResidents(loadedResidents);
        setPets(petData || []);
        if (loadedResidents.length > 0) {
          const nobodyAtHome = loadedResidents.every(resident => !resident.is_at_home);
          setConfig(previous => ({ ...previous, armed: nobodyAtHome }));
          localStorage.setItem("home_mode", nobodyAtHome ? "AUSENTE" : "EN_CASA");
        }
      }
      setHouseholdLoading(false);
    }
    loadHousehold();
    return () => { active = false; };
  }, [requestId]);

  useEffect(() => {
    let active = true;

    supabase
      .from("camera_devices")
      .select("stream_url")
      .eq("request_id", requestId)
      .eq("is_active", true)
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

  const secondaryConfiguredUrl = configuredCameras[1]?.stream_url || "";

  useEffect(() => {
    if (!secondaryConfiguredUrl) {
      return undefined;
    }
    let active = true;
    let refreshTimer;
    async function refreshSecondaryStream() {
      try {
        const secureUrl = await getSecureCameraStreamUrl(secondaryConfiguredUrl);
        if (!active) return;
        setSecondaryCameraUrl(secureUrl);
        refreshTimer = window.setTimeout(refreshSecondaryStream, STREAM_TOKEN_REFRESH_MS);
      } catch (error) {
        if (!active) return;
        setSecondaryCameraOnline(false);
        setSecondaryCameraUrl("");
        setNotice(`No se pudo abrir la Cámara 2: ${error.message}`);
      }
    }
    refreshSecondaryStream();
    return () => {
      active = false;
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [secondaryConfiguredUrl]);

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
                  if (!configRef.current.armed || !configRef.current.telegram || localStorage.getItem("home_mode") !== "AUSENTE") return;
                  lastAlertAtRef.current = now;
                  let imagen_base64 = null;
                  try {
                    imagen_base64 = analysisCanvas.toDataURL("image/jpeg", 0.82);
                  } catch (captureError) {
                    console.warn("No se pudo extraer la imagen para Telegram:", captureError);
                  }
                  fetch(ALERTS_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      message: "🚨 INTRUSIÓN: Persona detectada en el stream",
                      confidence: Math.round(category.score * 100),
                      tipo_evento: "Persona",
                      imagen_base64,
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
      getSecureCameraStreamUrl(configuredCameraUrl, { forceRefresh: true })
        .then(secureUrl => {
          const retryUrl = new URL(secureUrl);
          retryUrl.searchParams.set("t", Date.now().toString());
          setCameraUrl(retryUrl.toString());
        })
        .catch(error => setNotice(error.message));
      retryTimeoutRef.current = null;
    }, 3000);
  }

  function retrySecondaryCameraStream() {
    setSecondaryCameraOnline(false);
    getSecureCameraStreamUrl(secondaryConfiguredUrl, { forceRefresh: true })
      .then(secureUrl => {
        const retryUrl = new URL(secureUrl);
        retryUrl.searchParams.set("t", Date.now().toString());
        setSecondaryCameraUrl(retryUrl.toString());
      })
      .catch(error => setNotice(`La Cámara 2 perdió la conexión: ${error.message}`));
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
      if (!code?.display_code || code.used_at) {
        setAccessCode("");
        setAccessExpires("");
        return;
      }
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
      .select("display_code,expires_at,used_at")
      .eq("request_id", requestId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => receiveCode(data));

    const channel = supabase.channel(`camera-code-${requestId}`)
      .on("postgres_changes", {
        event: "*",
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
    if (key === "armed") {
      localStorage.setItem("home_mode", value ? "AUSENTE" : "EN_CASA");
      setNotice(value
        ? "Sistema activado: modo AUSENTE. Las alertas de intrusión están habilitadas."
        : "Sistema desactivado: modo EN CASA.");
      return;
    }
    setNotice("Configuración guardada en este dispositivo.");
  }

  async function savePhone() {
    if (!/^09\d{8}$/.test(phone)) {
      setPhoneError("Ingresa un celular ecuatoriano válido de 10 dígitos que comience con 09.");
      return;
    }
    setSavingPhone(true);
    setPhoneError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = user
      ? await supabase.from("profiles").update({ phone }).eq("id", user.id)
      : { error: new Error("Tu sesión caducó.") };
    setSavingPhone(false);
    if (error) {
      setPhoneError(`No se pudo guardar: ${error.message}`);
      return;
    }
    setNotice("Número de celular guardado correctamente.");
  }

  function applyPresenceMode(nextResidents) {
    if (nextResidents.length === 0) return;
    const nobodyAtHome = nextResidents.every(resident => !resident.is_at_home);
    setConfig(previous => ({ ...previous, armed: nobodyAtHome }));
    localStorage.setItem("home_mode", nobodyAtHome ? "AUSENTE" : "EN_CASA");
    setNotice(nobodyAtHome
      ? "Todos los residentes están ausentes. El sistema se activó automáticamente."
      : "Hay al menos un residente en casa. El sistema se desactivó automáticamente.");
  }

  async function addResident(event) {
    event.preventDefault();
    const cleanName = residentName.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2) {
      setHouseholdMessage("Escribe un nombre válido para el residente.");
      return;
    }
    setHouseholdMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("residents").insert({
      request_id: requestId,
      client_id: user.id,
      full_name: cleanName,
      role: residentRole.trim() || "Familiar",
      is_at_home: true,
    }).select("id,full_name,role,is_at_home").single();
    if (error) {
      setHouseholdMessage(`No se pudo agregar: ${error.message}`);
      return;
    }
    const nextResidents = [...residents, data];
    setResidents(nextResidents);
    setResidentName("");
    applyPresenceMode(nextResidents);
  }

  async function toggleResident(resident) {
    const nextAtHome = !resident.is_at_home;
    const nextResidents = residents.map(item => item.id === resident.id ? { ...item, is_at_home: nextAtHome } : item);
    setResidents(nextResidents);
    const { error } = await supabase.from("residents").update({ is_at_home: nextAtHome }).eq("id", resident.id);
    if (error) {
      setResidents(residents);
      setHouseholdMessage(`No se pudo actualizar: ${error.message}`);
      return;
    }
    applyPresenceMode(nextResidents);
  }

  async function removeResident(resident) {
    const { error } = await supabase.from("residents").delete().eq("id", resident.id);
    if (error) {
      setHouseholdMessage(`No se pudo eliminar: ${error.message}`);
      return;
    }
    const nextResidents = residents.filter(item => item.id !== resident.id);
    setResidents(nextResidents);
    applyPresenceMode(nextResidents);
  }

  async function addPet(event) {
    event.preventDefault();
    const cleanName = petName.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2) {
      setHouseholdMessage("Escribe un nombre válido para la mascota.");
      return;
    }
    setHouseholdMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("pets").insert({ request_id: requestId, client_id: user.id, name: cleanName, type: petType })
      .select("id,name,type").single();
    if (error) {
      setHouseholdMessage(`No se pudo agregar la mascota: ${error.message}`);
      return;
    }
    setPets(previous => [...previous, data]);
    setPetName("");
  }

  async function removePet(pet) {
    const { error } = await supabase.from("pets").delete().eq("id", pet.id);
    if (error) {
      setHouseholdMessage(`No se pudo eliminar: ${error.message}`);
      return;
    }
    setPets(previous => previous.filter(item => item.id !== pet.id));
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
          <div className="dual-camera-heading">
            <div><Video aria-hidden="true"/><span><b>Vista de cámaras</b><small>Monitoreo simultáneo del sistema</small></span></div>
            {configuredCameraUrl && <button type="button" className="fullscreen-button" onClick={openCameraFullscreen} aria-label="Ver cámaras en pantalla completa"><Maximize aria-hidden="true"/> Pantalla completa</button>}
          </div>
          <div className={`dual-camera-grid ${secondaryConfiguredUrl ? "has-two" : ""}`}>
            <section className="camera-feed">
              <div className="camera-topbar"><div><Video aria-hidden="true"/><i className={cameraOnline ? "online" : ""}/><b>Cámara 1</b></div><span>{cameraOnline ? "EN VIVO" : configuredCameraUrl ? "CONECTANDO" : "SIN CONFIGURAR"}</span></div>
              <div className="camera-screen">
                {cameraUrl ? <>
                  <img ref={imgRef} crossOrigin="anonymous" src={cameraUrl} alt="Transmisión en vivo de la Cámara 1" onLoad={() => { setCameraOnline(true); setNotice(""); }} onError={retryCameraStream}/>
                  <canvas ref={canvasRef} aria-hidden="true" />
                </> : <div className="camera-placeholder"><span><Video aria-hidden="true"/></span><b>{configuredCameraUrl ? "Cargando Cámara 1" : "Cámara 1 sin configurar"}</b><p>{configuredCameraUrl ? "Validando la transmisión segura…" : "El administrador debe asignar esta cámara."}</p></div>}
              </div>
            </section>
            <section className="camera-feed">
              <div className="camera-topbar"><div><Video aria-hidden="true"/><i className={secondaryCameraOnline ? "online" : ""}/><b>Cámara 2</b></div><span>{secondaryCameraOnline ? "EN VIVO" : secondaryConfiguredUrl ? "CONECTANDO" : "SIN CONFIGURAR"}</span></div>
              <div className="camera-screen">
                {secondaryCameraUrl ? <img crossOrigin="anonymous" src={secondaryCameraUrl} alt="Transmisión en vivo de la Cámara 2" onLoad={() => setSecondaryCameraOnline(true)} onError={retrySecondaryCameraStream}/> : <div className="camera-placeholder"><span><Video aria-hidden="true"/></span><b>{secondaryConfiguredUrl ? "Cargando Cámara 2" : "Cámara 2 sin configurar"}</b><p>{secondaryConfiguredUrl ? "Validando la transmisión segura…" : "El administrador debe asignar una segunda cámara."}</p></div>}
              </div>
            </section>
          </div>
          <div className="camera-permission">
            <div><b>Acceso temporal para soporte</b><span>El administrador debe solicitar acceso. Recibirás un código nuevo que caduca en 5 minutos.</span></div>
            <span className="waiting-access">{accessCode ? "Solicitud recibida" : "Sin solicitudes"}</span>
          </div>
        </article>

        <aside className="quick-controls">
          <article className="control-card alarm-card">
            <span className="control-icon alarm-icon"><BellRing aria-hidden="true"/></span>
            <div><h3>Sirena</h3><p>Prueba el sonido de alarma.</p></div>
            <button type="button" disabled={sounding} onClick={testAlarm}>{sounding ? "Sonando..." : "Sonar alarma"}</button>
          </article>
          <article className="control-card">
            <span className="control-icon"><Nfc aria-hidden="true"/></span>
            <div><h3>Alarma de puerta NFC</h3><p>Avisa cuando se abra sin una tarjeta autorizada.</p></div>
            <button type="button" className={`switch ${config.nfcDoor ? "on" : ""}`} aria-label="Activar alarma NFC" aria-pressed={config.nfcDoor} onClick={() => update("nfcDoor", !config.nfcDoor)}><span/></button>
          </article>
          <article className="control-card">
            <span className="control-icon"><Send aria-hidden="true"/></span>
            <div><h3>Alertas de Telegram</h3><p>Envía los eventos al chat vinculado.</p></div>
            <button type="button" className={`switch ${config.telegram ? "on" : ""}`} aria-label="Activar Telegram" aria-pressed={config.telegram} onClick={() => update("telegram", !config.telegram)}><span/></button>
          </article>
          <article className="control-card phone-control-card">
            <span className="control-icon"><Phone aria-hidden="true"/></span>
            <div><h3>Número para notificaciones</h3><p>Completa el celular asociado a tus alertas.</p></div>
            <div className="phone-control-form">
              <input aria-label="Número de celular" inputMode="numeric" maxLength={10} placeholder="09XXXXXXXX" value={phone} onChange={event => {
                setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                setPhoneError("");
              }}/>
              <button type="button" onClick={savePhone} disabled={savingPhone}>{savingPhone ? "Guardando…" : "Guardar"}</button>
              {phoneError && <small className="field-error" role="alert">{phoneError}</small>}
            </div>
          </article>
          <article className="control-card">
            <span className="control-icon"><Radio aria-hidden="true"/></span>
            <div><h3>Sensores</h3><p>Los sensores se vinculan durante la instalación.</p></div>
            <span className="device-badge">Pendiente</span>
          </article>
        </aside>
      </div>

      <section className="household-management-grid" aria-label="Gestión del hogar">
        <article className="household-card">
          <div className="household-card-heading"><span className="control-icon"><Users aria-hidden="true"/></span><div><h3>Gestión de residentes</h3><p>El modo de seguridad cambia según quién esté en casa.</p></div></div>
          <form className="household-add-form resident-add-form" onSubmit={addResident}>
            <input maxLength={80} placeholder="Nombre completo" value={residentName} onChange={event => setResidentName(event.target.value)} aria-label="Nombre del residente"/>
            <input maxLength={40} placeholder="Rol: familiar, cuidador…" value={residentRole} onChange={event => setResidentRole(event.target.value)} aria-label="Rol del residente"/>
            <button type="submit">＋ Agregar</button>
          </form>
          {householdLoading ? <p className="empty-residents">Cargando residentes…</p> : residents.length ? <ul className="household-list">
            {residents.map(resident => <li key={resident.id}>
              <span className="household-avatar">{resident.full_name.charAt(0).toUpperCase()}</span>
              <div><b>{resident.full_name}</b><small>{resident.role}</small></div>
              <button type="button" className={`presence-toggle ${resident.is_at_home ? "at-home" : "away"}`} onClick={() => toggleResident(resident)} aria-pressed={resident.is_at_home}>{resident.is_at_home ? "En casa" : "Ausente"}</button>
              <button type="button" className="household-delete" onClick={() => removeResident(resident)} aria-label={`Eliminar a ${resident.full_name}`}>×</button>
            </li>)}
          </ul> : <p className="empty-residents">Todavía no hay residentes. La activación manual seguirá disponible.</p>}
        </article>

        <article className="household-card">
          <div className="household-card-heading"><span className="control-icon"><PawPrint aria-hidden="true"/></span><div><h3>Gestión de mascotas</h3><p>Registra las mascotas para identificar el entorno del hogar.</p></div></div>
          <form className="household-add-form" onSubmit={addPet}>
            <input maxLength={80} placeholder="Nombre de la mascota" value={petName} onChange={event => setPetName(event.target.value)} aria-label="Nombre de la mascota"/>
            <select value={petType} onChange={event => setPetType(event.target.value)} aria-label="Tipo de mascota"><option>Perro</option><option>Gato</option><option>Ave</option><option>Otro</option></select>
            <button type="submit">＋ Agregar</button>
          </form>
          {householdLoading ? <p className="empty-residents">Cargando mascotas…</p> : pets.length ? <ul className="household-list pet-list">
            {pets.map(pet => <li key={pet.id}><span className="household-avatar pet-avatar"><PawPrint aria-hidden="true"/></span><div><b>{pet.name}</b><small>{pet.type}</small></div><button type="button" className="household-delete" onClick={() => removePet(pet)} aria-label={`Eliminar a ${pet.name}`}>×</button></li>)}
          </ul> : <p className="empty-residents">Todavía no hay mascotas registradas.</p>}
        </article>
      </section>
      {householdMessage && <p className="control-notice" role="status">{householdMessage}</p>}

      {accessCode && !urgentDismissed && <aside className="urgent-camera-code" role="alert">
        <button type="button" className="urgent-close" aria-label="Cerrar alerta" onClick={() => setUrgentDismissed(true)}>×</button>
        <span><TriangleAlert aria-hidden="true"/></span><div><b>Solicitud urgente de acceso a cámara</b><p>Comparte este código únicamente con el administrador. Caduca en 5 minutos y funciona una sola vez.</p><strong>{accessCode}</strong></div>
      </aside>}

      <article className="schedule-card">
        <div className="schedule-title"><span><Clock3 aria-hidden="true"/></span><div><h3>Horario de protección</h3><p>Decide cuándo se activará automáticamente el sistema.</p></div></div>
        <div className="mode-buttons">
          <button type="button" className={scheduleDraft.mode === "always" ? "selected" : ""} onClick={() => setScheduleDraft(previous => ({ ...previous, mode: "always" }))}><span><Sun aria-hidden="true"/></span><b>Todo el día</b><small>Protección continua 24/7</small></button>
          <button type="button" className={scheduleDraft.mode === "custom" ? "selected" : ""} onClick={() => setScheduleDraft(previous => ({ ...previous, mode: "custom" }))}><span><CalendarDays aria-hidden="true"/></span><b>Personalizado</b><small>Elige días y horas</small></button>
        </div>
        {scheduleDraft.mode === "always" && <div className="all-day-schedule">
          <span><ShieldCheck aria-hidden="true"/></span>
          <div><b>Protección activa las 24 horas</b><p>El sistema permanecerá preparado todos los días, sin interrupciones.</p></div>
          <button type="button" onClick={confirmAllDay}>{config.mode === "always" ? "Confirmar nuevamente" : "Confirmar todo el día"}</button>
        </div>}
        {scheduleDraft.mode === "custom" && <div className="custom-schedule">
          <div className="schedule-days">
            <span>Días activos</span>
            <div className="day-picker">{days.map(([value, label]) => <button type="button" aria-label={value} className={scheduleDraft.days.includes(value) ? "selected" : ""} onClick={() => toggleDay(value)} key={value}><i>✓</i>{label}</button>)}</div>
          </div>
          <div className="time-range">
            <label><span><Moon aria-hidden="true"/> Hora de inicio</span><select value={scheduleDraft.start} onChange={event => setScheduleDraft(previous => ({ ...previous, start: event.target.value }))}>{timeOptions.map(time => <option value={time} key={time}>{time}</option>)}</select></label>
            <b>→</b>
            <label><span><Sun aria-hidden="true"/> Hora de fin</span><select value={scheduleDraft.end} onChange={event => setScheduleDraft(previous => ({ ...previous, end: event.target.value }))}>{timeOptions.map(time => <option value={time} key={time}>{time}</option>)}</select></label>
          </div>
          <p className="schedule-summary"><ShieldCheck aria-hidden="true"/> El sistema se activará de <strong>{scheduleDraft.start}</strong> a <strong>{scheduleDraft.end}</strong> los días seleccionados.</p>
          <button type="button" className="confirm-schedule-button" onClick={confirmCustomSchedule}>✓ Confirmar horario personalizado</button>
        </div>}
        <p className="saved-schedule">Configuración guardada: <strong>{config.mode === "always" ? "protección todo el día" : `${config.start} a ${config.end}`}</strong></p>
      </article>
      <p className="integration-note">Los ajustes se guardan en este navegador. Para controlar la cámara, sirena, NFC y Telegram físicamente, el técnico debe conectar la API del equipo instalado.</p>
    </section>
  );
}

export default SecurityCenter;
