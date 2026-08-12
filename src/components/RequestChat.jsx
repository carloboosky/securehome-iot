import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import AppointmentScheduler from "./AppointmentScheduler";

const helpTopics = [
  { id: "appointment", icon: "📅", title: "Citas de instalación", questions: [
    { title: "Quiero agendar una cita", steps: ["Abre el calendario.", "Elige una fecha laborable.", "Selecciona un horario disponible.", "Pulsa Solicitar cita."], actions: [{ label: "Abrir calendario", type: "appointment" }] },
    { title: "Mi cita fue cancelada", steps: ["Abre el calendario de instalación.", "Escoge una nueva fecha y hora.", "Pulsa Reagendar cita."], actions: [{ label: "Reagendar ahora", type: "appointment" }] },
    { title: "No encuentro horarios", steps: ["Prueba otra fecha de lunes a viernes.", "Recuerda reservar con 2 horas de anticipación.", "Si no aparece ningún turno, solicita ayuda a administración."], actions: [{ label: "Contactar administración", type: "admin", message: "Hola, no encuentro horarios disponibles para mi instalación." }] },
  ] },
  { id: "status", icon: "📋", title: "Estado de mi solicitud", questions: [
    { title: "¿Qué significa mi estado?", steps: ["Pendiente: recibimos tu solicitud.", "Contactado: administración se comunicó contigo.", "Programado: existe una visita coordinada.", "Instalado: el sistema ya fue habilitado.", "Cancelado: puedes registrar una nueva solicitud."], actions: [{ label: "Preguntar por mi caso", type: "admin", message: "Hola, quisiera información sobre el estado de mi solicitud." }] },
    { title: "Mi estado no cambia", steps: ["Los cambios deben aparecer automáticamente.", "Comprueba que el indicador diga En tiempo real.", "Si continúa igual, informa a administración."], actions: [{ label: "Reportar problema", type: "admin", message: "Hola, el estado de mi solicitud no se está actualizando." }] },
  ] },
  { id: "plans", icon: "🛡️", title: "Planes y precios", questions: [
    { title: "Comparar los planes", steps: ["Esencial: protección para espacios pequeños.", "Protección Plus: más cámaras y sensor de movimiento.", "Total: sensores y control mediante NFC.", "Los valores del MVP son referenciales."], actions: [{ label: "Ver planes", type: "link", href: "/#planes" }, { label: "Pedir asesoría", type: "admin", message: "Hola, necesito ayuda para elegir un plan." }] },
  ] },
  { id: "term", icon: "🗓️", title: "Permanencia y contrato", questions: [
    { title: "¿Cuánto dura la permanencia?", steps: ["La permanencia mínima es de 4 meses.", "Se cuenta desde la activación del sistema.", "Una cancelación anticipada está sujeta a los términos aceptados."], actions: [{ label: "Leer términos", type: "link", href: "/terminos" }] },
  ] },
  { id: "telegram", icon: "📲", title: "Alertas por Telegram", questions: [
    { title: "Quiero vincular Telegram", steps: ["Abre el Centro de seguridad.", "Busca Vincular celular con Telegram.", "Ingresa el identificador de chat.", "Guarda y espera el mensaje de confirmación."], actions: [{ label: "Necesito ayuda", type: "admin", message: "Hola, necesito ayuda para vincular Telegram." }] },
    { title: "No recibo alertas", steps: ["Comprueba que Telegram esté vinculado.", "Verifica que el sistema esté activado.", "Confirma que la cámara esté en línea.", "Si persiste, solicita revisión técnica."], actions: [{ label: "Solicitar revisión", type: "admin", message: "Hola, no estoy recibiendo alertas de Telegram." }] },
  ] },
  { id: "cameras", icon: "📹", title: "Cámaras y detección", questions: [
    { title: "No puedo ver la cámara", steps: ["Comprueba tu conexión a internet.", "Espera el reintento automático del stream.", "Verifica que administración haya asignado una cámara.", "Solicita soporte si continúa sin imagen."], actions: [{ label: "Solicitar soporte", type: "admin", message: "Hola, no puedo visualizar la cámara en mi panel." }] },
    { title: "¿Cómo detecta personas?", steps: ["La ESP32-CAM transmite el video.", "MediaPipe analiza los fotogramas en el navegador.", "Cuando detecta una persona, el backend gestiona la alerta."], actions: [] },
  ] },
  { id: "household", icon: "👥", title: "Residentes y mascotas", questions: [
    { title: "Agregar un residente", steps: ["Abre Gestión de residentes.", "Escribe el nombre.", "Selecciona Familiar, Amigo, Cuidador o Personal doméstico.", "Pulsa Agregar."], actions: [] },
    { title: "¿Cómo cambia el modo de seguridad?", steps: ["Marca quién está En casa o Ausente.", "Si todos están ausentes, el sistema se activa.", "Si alguien está en casa, se desactiva automáticamente."], actions: [] },
  ] },
];

function RequestChat({ requestId, role }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [showAppointment, setShowAppointment] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedHelpTopic, setSelectedHelpTopic] = useState(null);
  const [selectedHelpAnswer, setSelectedHelpAnswer] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const messagesRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadMessages({ initial = false } = {}) {
      const { data, error: queryError } = await supabase
        .from("service_messages")
        .select("id,sender_id,sender_role,message,image_path,read_at,created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      if (!active) return;
      if (queryError) {
        setError(
          `El chat no está disponible: ${queryError.message}`
        );
      }
      else {
        setMessages(data || []);
        setError("");
      }
      if (initial) setLoading(false);
    }

    const channel = supabase
      .channel(`request-chat-${requestId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "service_messages",
        filter: `request_id=eq.${requestId}`,
      }, payload => {
        setMessages(previous =>
          previous.some(item => item.id === payload.new.id)
            ? previous
            : [...previous, payload.new]
        );
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          loadMessages();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setRealtimeStatus("fallback");
        } else {
          setRealtimeStatus("connecting");
        }
      });

    loadMessages({ initial: true });

    // Respaldo para redes inestables o proyectos donde la publicación
    // Realtime aún no haya sido aplicada. Sincroniza sin recargar la página.
    const syncInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") loadMessages();
    }, 3000);

    function syncWhenVisible() {
      if (document.visibilityState === "visible") loadMessages();
    }
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      active = false;
      window.clearInterval(syncInterval);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    const cleanText = text.trim();
    if ((!cleanText && !file) || sending) return;
    setSending(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Tu sesión terminó. Vuelve a iniciar sesión.");
      setSending(false);
      return;
    }

    let imagePath = null;
    if (file) {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        setError("Selecciona una imagen válida de máximo 5 MB.");
        setSending(false);
        return;
      }
      imagePath = `${requestId}/${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("chat-images").upload(imagePath, file);
      if (uploadError) {
        setError(`No se pudo subir la fotografía: ${uploadError.message}`);
        setSending(false);
        return;
      }
    }

    const { data, error: insertError } = await supabase
      .from("service_messages")
      .insert({
        request_id: requestId,
        sender_id: user.id,
        sender_role: role,
        message: cleanText || null,
        image_path: imagePath,
      })
      .select("id,sender_id,sender_role,message,image_path,read_at,created_at")
      .single();

    if (insertError) setError(`No se pudo enviar el mensaje: ${insertError.message}`);
    else {
      setMessages(previous => previous.some(item => item.id === data.id) ? previous : [...previous, data]);
      setText("");
      setFile(null);
    }
    setSending(false);
  }

  function messageTime(date) {
    return new Intl.DateTimeFormat("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  function runHelpAction(action) {
    if (action.type === "appointment") {
      setShowHelp(false);
      setSelectedHelpTopic(null);
      setSelectedHelpAnswer(null);
      setShowAppointment(true);
      return;
    }
    if (action.type === "admin") {
      setText(action.message);
      setShowHelp(false);
      setSelectedHelpTopic(null);
      setSelectedHelpAnswer(null);
      return;
    }
    if (action.type === "link") window.location.assign(action.href);
  }

  function resetHelp() {
    setSelectedHelpTopic(null);
    setSelectedHelpAnswer(null);
  }

  return (
    <div className="request-chat">
      <div className="chat-header">
        <div><span>💬</span><div><h3>Chat de soporte</h3><p>Conversación entre cliente y administración</p></div></div>
        <div className="chat-header-actions">
          {role === "client" && !showAppointment && !showHelp && <><button type="button" className="chat-help-button" onClick={() => setShowHelp(true)}>🤖 Ayuda rápida</button><button type="button" className="chat-appointment-button" onClick={() => setShowAppointment(true)}>📅 Agendar visita</button></>}
          <span className={`chat-online ${realtimeStatus}`} title={realtimeStatus === "fallback" ? "Sincronización automática cada 3 segundos" : "Conexión en tiempo real"}><i/> {realtimeStatus === "connected" ? "En tiempo real" : realtimeStatus === "fallback" ? "Sincronizando" : "Conectando"}</span>
        </div>
      </div>
      {showAppointment && role === "client" ? <div className="chat-appointment-panel">
        <div className="chat-assistant-message"><span>🤖</span><div><b>Asistente de instalación</b><p>Selecciona una fecha y una hora disponibles. También puedes reagendar si tu cita fue cancelada.</p></div></div>
        <AppointmentScheduler requestId={requestId} embedded defaultExpanded />
        <button type="button" className="chat-return-button" onClick={() => setShowAppointment(false)}>← Volver al chat</button>
      </div> : showHelp && role === "client" ? <div className="chat-help-panel">
        <div className="chat-assistant-message"><span>🤖</span><div><b>Asistente SecureHome</b><p>Selecciona el tema sobre el que necesitas ayuda. Este asistente es gratuito y utiliza respuestas verificadas.</p></div></div>
        {!selectedHelpTopic ? <div className="chat-help-topics">{helpTopics.map(topic => <button type="button" key={topic.id} onClick={() => setSelectedHelpTopic(topic)}><span>{topic.icon}</span><b>{topic.title}</b><i>›</i></button>)}</div> : !selectedHelpAnswer ? <div className="chat-help-questions">
          <div className="chat-help-breadcrumb"><button type="button" onClick={resetHelp}>← Temas</button><span>{selectedHelpTopic.icon} {selectedHelpTopic.title}</span></div>
          <p>¿Qué necesitas resolver?</p>
          {selectedHelpTopic.questions.map(question => <button type="button" key={question.title} onClick={() => setSelectedHelpAnswer(question)}><span>?</span><b>{question.title}</b><i>›</i></button>)}
        </div> : <div className="chat-help-answer">
          <div className="chat-bot-bubble"><span>🤖</span><div><small>Asistente SecureHome</small><h3>{selectedHelpAnswer.title}</h3></div></div>
          <ol>{selectedHelpAnswer.steps.map(step => <li key={step}>{step}</li>)}</ol>
          {selectedHelpAnswer.actions.length > 0 && <div className="chat-help-actions">{selectedHelpAnswer.actions.map(action => <button type="button" className={action.type === "appointment" ? "chat-help-primary" : ""} onClick={() => runHelpAction(action)} key={action.label}>{action.label}</button>)}</div>}
          <div className="chat-help-feedback"><span>¿Te ayudó esta respuesta?</span><button type="button" onClick={() => setSelectedHelpAnswer(null)}>Sí, otra pregunta</button><button type="button" onClick={() => runHelpAction({ type: "admin", message: `Hola, necesito más ayuda con: ${selectedHelpAnswer.title}.` })}>No, hablar con alguien</button></div>
        </div>}
        {!selectedHelpAnswer && <div className="chat-help-footer"><p>¿No encuentras tu pregunta?</p><button type="button" onClick={() => runHelpAction({ type: "admin", message: "Hola, necesito ayuda con mi sistema SecureHome." })}>Hablar con administración</button></div>}
        <button type="button" className="chat-return-button" onClick={() => { setShowHelp(false); resetHelp(); }}>← Volver al chat</button>
      </div> : <div className="chat-messages" aria-live="polite" ref={messagesRef}>
        {loading ? <p className="chat-empty">Cargando conversación...</p> :
          messages.length === 0 ? <div className="chat-empty"><span>👋</span><b>Inicia la conversación</b><p>Escribe un mensaje sobre la instalación o el sistema.</p></div> :
          messages.map(item => {
            const mine = item.sender_role === role;
            return <div className={`chat-message ${mine ? "mine" : ""}`} key={item.id}>
              <small>{mine ? "Tú" : item.sender_role === "admin" ? "Administración" : "Cliente"}</small>
              {item.image_path && <ChatImage path={item.image_path}/>}
              {item.message && <p>{item.message}</p>}<time>{messageTime(item.created_at)}</time>
            </div>;
          })}
      </div>}
      {error && <p className="chat-error">{error}</p>}
      {!showAppointment && !showHelp && <form className="chat-form" onSubmit={send}>
        <label className="chat-photo-button" title="Enviar fotografía">📷<input type="file" accept="image/*" onChange={event => setFile(event.target.files?.[0] || null)}/></label>
        <textarea aria-label="Escribe un mensaje" maxLength={1000} placeholder={file ? `Foto seleccionada: ${file.name}` : "Escribe tu mensaje..."} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}/>
        <button type="submit" disabled={sending || (!text.trim() && !file)}>{sending ? "Enviando..." : "Enviar ➤"}</button>
      </form>}
    </div>
  );
}

function ChatImage({ path }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    supabase.storage.from("chat-images").createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl || ""));
  }, [path]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img className="chat-image" src={url} alt="Fotografía enviada en el chat"/></a> : <span>Cargando fotografía...</span>;
}

export default RequestChat;
