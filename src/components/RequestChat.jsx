import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import AppointmentScheduler from "./AppointmentScheduler";

const helpTopics = [
  { id: "appointment", icon: "📅", title: "Agendar o reagendar una cita", answer: "Puedes seleccionar una fecha laborable y un horario disponible. La reserva requiere al menos 2 horas de anticipación.", action: "appointment" },
  { id: "status", icon: "📋", title: "Estado de mi instalación", answer: "En tu panel puedes consultar si la solicitud está pendiente, contactada, programada, instalada o cancelada. Los cambios de administración aparecen automáticamente." },
  { id: "plans", icon: "🛡️", title: "Planes y precios", answer: "SecureHome ofrece los planes Esencial, Protección Plus y Total. Los valores mostrados en la página son referenciales del prototipo y dependen de la validación técnica." },
  { id: "term", icon: "🗓️", title: "Permanencia mínima", answer: "Los planes contemplan una permanencia mínima de 4 meses desde la activación del sistema." },
  { id: "telegram", icon: "📲", title: "Configurar Telegram", answer: "Desde el Centro de seguridad puedes vincular el identificador del chat de Telegram para recibir fotografías y avisos de eventos." },
  { id: "cameras", icon: "📹", title: "Cámaras y detección", answer: "La ESP32-CAM transmite el video. En el MVP, MediaPipe detecta personas desde el navegador y el backend gestiona el stream y las alertas." },
  { id: "household", icon: "👥", title: "Residentes y mascotas", answer: "En Gestión del hogar puedes registrar residentes y mascotas. La presencia de residentes permite ajustar automáticamente el modo de seguridad." },
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
        if (status === "SUBSCRIBED") loadMessages();
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

  return (
    <div className="request-chat">
      <div className="chat-header">
        <div><span>💬</span><div><h3>Chat de soporte</h3><p>Conversación entre cliente y administración</p></div></div>
        <div className="chat-header-actions">
          {role === "client" && !showAppointment && !showHelp && <><button type="button" className="chat-help-button" onClick={() => setShowHelp(true)}>🤖 Ayuda rápida</button><button type="button" className="chat-appointment-button" onClick={() => setShowAppointment(true)}>📅 Agendar visita</button></>}
          <span className="chat-online"><i/> En línea</span>
        </div>
      </div>
      {showAppointment && role === "client" ? <div className="chat-appointment-panel">
        <div className="chat-assistant-message"><span>🤖</span><div><b>Asistente de instalación</b><p>Selecciona una fecha y una hora disponibles. También puedes reagendar si tu cita fue cancelada.</p></div></div>
        <AppointmentScheduler requestId={requestId} embedded defaultExpanded />
        <button type="button" className="chat-return-button" onClick={() => setShowAppointment(false)}>← Volver al chat</button>
      </div> : showHelp && role === "client" ? <div className="chat-help-panel">
        <div className="chat-assistant-message"><span>🤖</span><div><b>Asistente SecureHome</b><p>Selecciona el tema sobre el que necesitas ayuda. Este asistente es gratuito y utiliza respuestas verificadas.</p></div></div>
        {!selectedHelpTopic ? <div className="chat-help-topics">{helpTopics.map(topic => <button type="button" key={topic.id} onClick={() => setSelectedHelpTopic(topic)}><span>{topic.icon}</span><b>{topic.title}</b><i>›</i></button>)}</div> : <div className="chat-help-answer">
          <span>{selectedHelpTopic.icon}</span><h3>{selectedHelpTopic.title}</h3><p>{selectedHelpTopic.answer}</p>
          {selectedHelpTopic.action === "appointment" && <button type="button" className="chat-help-primary" onClick={() => { setShowHelp(false); setSelectedHelpTopic(null); setShowAppointment(true); }}>Abrir calendario</button>}
          <button type="button" onClick={() => setSelectedHelpTopic(null)}>← Consultar otro tema</button>
        </div>}
        <div className="chat-help-footer"><p>¿No encontraste la respuesta?</p><button type="button" onClick={() => { setShowHelp(false); setSelectedHelpTopic(null); setText("Hola, necesito ayuda con "); }}>Hablar con administración</button></div>
        <button type="button" className="chat-return-button" onClick={() => { setShowHelp(false); setSelectedHelpTopic(null); }}>← Volver al chat</button>
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
