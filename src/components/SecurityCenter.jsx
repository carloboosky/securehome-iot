import { useEffect, useState } from "react";

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
  cameraUrl: "",
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
  const [cameraInput, setCameraInput] = useState(config.cameraUrl);
  const [notice, setNotice] = useState("");
  const [sounding, setSounding] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, [config, storageKey]);

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
            <div><i className={config.cameraUrl ? "online" : ""}/><b>Cámara principal</b></div>
            <span>{config.cameraUrl ? "EN VIVO" : "SIN CONEXIÓN"}</span>
          </div>
          <div className="camera-screen">
            {config.cameraUrl
              ? <img src={config.cameraUrl} alt="Transmisión configurada por el usuario" onError={() => setNotice("No se pudo abrir la dirección de la cámara. Revisa la URL o la conexión.")}/>
              : <div className="camera-placeholder"><span>📷</span><b>Cámara pendiente de conexión</b><p>Introduce la URL proporcionada por el técnico para proyectar la transmisión.</p></div>}
          </div>
          <div className="camera-config">
            <input type="url" aria-label="Dirección de la cámara" placeholder="https://dirección-segura-de-la-cámara" value={cameraInput} onChange={event => setCameraInput(event.target.value)}/>
            <button type="button" onClick={() => update("cameraUrl", cameraInput.trim())}>Conectar</button>
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
