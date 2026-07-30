import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const days = [
  ["lun", "L"], ["mar", "M"], ["mie", "X"], ["jue", "J"],
  ["vie", "V"], ["sab", "S"], ["dom", "D"],
];

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
      return { ...defaultConfig, ...JSON.parse(localStorage.getItem(storageKey)) };
    } catch {
      return defaultConfig;
    }
  });
  const [cameraUrl, setCameraUrl] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [notice, setNotice] = useState("");
  const [sounding, setSounding] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, [config, storageKey]);

  useEffect(() => {
    supabaseCamera();
    async function supabaseCamera() {
      const { data } = await supabase.from("camera_devices").select("stream_url").eq("request_id", requestId).maybeSingle();
      setCameraUrl(data?.stream_url || "");
    }
  }, [requestId]);

  async function createAccessCode() {
    const { data, error } = await supabase.rpc("create_camera_access_code", {
      target_request_id: requestId,
    });
    if (error) setNotice(`No se pudo generar el código: ${error.message}`);
    else {
      setAccessCode(data);
      setNotice("Comparte este código únicamente con el administrador. Caduca en 10 minutos.");
    }
  }

  function update(key, value) {
    setConfig(previous => ({ ...previous, [key]: value }));
    setNotice("Configuración guardada en este dispositivo.");
  }

  function toggleDay(day) {
    update("days", config.days.includes(day)
      ? config.days.filter(item => item !== day)
      : [...config.days, day]);
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
        <article className="camera-panel">
          <div className="camera-topbar">
            <div><i className={cameraUrl ? "online" : ""}/><b>Cámara principal</b></div>
            <span>{cameraUrl ? "EN VIVO" : "SIN CONEXIÓN"}</span>
          </div>
          <div className="camera-screen">
            {cameraUrl
              ? <img src={cameraUrl} alt="Transmisión de la cámara del cliente" onError={() => setNotice("No se pudo abrir la cámara. Solicita al administrador que revise la conexión.")}/>
              : <div className="camera-placeholder"><span>📷</span><b>Cámara pendiente de configuración</b><p>Por seguridad, solamente el administrador puede configurar la dirección de transmisión.</p></div>}
          </div>
          <div className="camera-permission">
            <div><b>Acceso temporal para soporte</b><span>Genera un código si el administrador necesita revisar la cámara.</span></div>
            {accessCode && <strong>{accessCode}</strong>}
            <button type="button" onClick={createAccessCode}>{accessCode ? "Generar otro" : "Generar código"}</button>
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

      <article className="schedule-card">
        <div className="schedule-title"><span>🕒</span><div><h3>Horario de protección</h3><p>Decide cuándo se activará automáticamente el sistema.</p></div></div>
        <div className="mode-buttons">
          <button type="button" className={config.mode === "always" ? "selected" : ""} onClick={() => update("mode", "always")}>Todo el día</button>
          <button type="button" className={config.mode === "custom" ? "selected" : ""} onClick={() => update("mode", "custom")}>Horario personalizado</button>
        </div>
        {config.mode === "custom" && <div className="custom-schedule">
          <div className="day-picker">{days.map(([value, label]) => <button type="button" aria-label={value} className={config.days.includes(value) ? "selected" : ""} onClick={() => toggleDay(value)} key={value}>{label}</button>)}</div>
          <label>Desde <input type="time" value={config.start} onChange={event => update("start", event.target.value)}/></label>
          <label>Hasta <input type="time" value={config.end} onChange={event => update("end", event.target.value)}/></label>
        </div>}
      </article>
      <p className="integration-note">Los ajustes se guardan en este navegador. Para controlar la cámara, sirena, NFC y Telegram físicamente, el técnico debe conectar la API del equipo instalado.</p>
    </section>
  );
}

export default SecurityCenter;
