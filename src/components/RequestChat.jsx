import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import AppointmentScheduler from "./AppointmentScheduler";

function RequestChat({ requestId, role }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [showAppointment, setShowAppointment] = useState(false);
  const messagesRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadMessages() {
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
      else setMessages(data || []);
      setLoading(false);
    }

    loadMessages();
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
      .subscribe();

    return () => {
      active = false;
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
          {role === "client" && <button type="button" className="chat-appointment-button" aria-pressed={showAppointment} onClick={() => setShowAppointment(value => !value)}>{showAppointment ? "Volver al chat" : "📅 Agendar visita"}</button>}
          <span className="chat-online"><i/> En línea</span>
        </div>
      </div>
      {showAppointment && role === "client" ? <div className="chat-appointment-panel">
        <div className="chat-assistant-message"><span>🤖</span><div><b>Asistente de instalación</b><p>Selecciona una fecha y una hora disponibles. También puedes reagendar si tu cita fue cancelada.</p></div></div>
        <AppointmentScheduler requestId={requestId} embedded defaultExpanded />
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
      {!showAppointment && <form className="chat-form" onSubmit={send}>
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
