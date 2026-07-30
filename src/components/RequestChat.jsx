import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function RequestChat({ requestId, role }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadMessages() {
      const { data, error: queryError } = await supabase
        .from("service_messages")
        .select("id,sender_id,sender_role,message,created_at")
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
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || sending) return;
    setSending(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Tu sesión terminó. Vuelve a iniciar sesión.");
      setSending(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("service_messages")
      .insert({
        request_id: requestId,
        sender_id: user.id,
        sender_role: role,
        message: cleanText,
      })
      .select("id,sender_id,sender_role,message,created_at")
      .single();

    if (insertError) setError(`No se pudo enviar el mensaje: ${insertError.message}`);
    else {
      setMessages(previous => previous.some(item => item.id === data.id) ? previous : [...previous, data]);
      setText("");
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
        <span className="chat-online"><i/> En línea</span>
      </div>
      <div className="chat-messages" aria-live="polite">
        {loading ? <p className="chat-empty">Cargando conversación...</p> :
          messages.length === 0 ? <div className="chat-empty"><span>👋</span><b>Inicia la conversación</b><p>Escribe un mensaje sobre la instalación o el sistema.</p></div> :
          messages.map(item => {
            const mine = item.sender_role === role;
            return <div className={`chat-message ${mine ? "mine" : ""}`} key={item.id}>
              <small>{mine ? "Tú" : item.sender_role === "admin" ? "Administración" : "Cliente"}</small>
              <p>{item.message}</p><time>{messageTime(item.created_at)}</time>
            </div>;
          })}
        <div ref={endRef}/>
      </div>
      {error && <p className="chat-error">{error}</p>}
      <form className="chat-form" onSubmit={send}>
        <textarea aria-label="Escribe un mensaje" maxLength={1000} placeholder="Escribe tu mensaje..." value={text} onChange={event => setText(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}/>
        <button type="submit" disabled={sending || !text.trim()}>{sending ? "Enviando..." : "Enviar ➤"}</button>
      </form>
    </div>
  );
}

export default RequestChat;
