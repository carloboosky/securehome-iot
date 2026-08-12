import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

function MessageNotifications({ role, requestId, chatOpen, onOpen, showBubble = true }) {
  const [pending, setPending] = useState([]);
  const [latest, setLatest] = useState(null);
  const chatOpenRef = useRef(chatOpen);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  useEffect(() => {
    let active = true;
    let query = supabase.from("service_messages")
      .select("id,request_id,sender_role,message,image_path,created_at")
      .neq("sender_role", role)
      .is("read_at", null)
      .order("created_at", { ascending: false });

    if (requestId) {
      query = query.eq("request_id", requestId);
    }

    query.then(({ data }) => {
        if (active) setPending(data || []);
      });

    const channelName = requestId ? `message-alerts-${requestId}` : `message-alerts-${role}`;
    const filter = requestId ? `request_id=eq.${requestId}` : undefined;

    const channel = supabase.channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "service_messages", filter }, payload => {
        if (payload.new.sender_role === role) return;
        
        if (chatOpenRef.current && (!requestId || requestId === payload.new.request_id)) return;

        setPending(items => items.some(item => item.id === payload.new.id) ? items : [payload.new, ...items]);
        setLatest(payload.new);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Nuevo mensaje de SecureHome", {
            body: payload.new.message || "Te enviaron una fotografía.",
          });
        }
      }).subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [role, requestId]);

  async function openConversation(requestId) {
    const ids = pending.filter(item => item.request_id === requestId).map(item => item.id);
    if (ids.length) {
      await supabase.from("service_messages").update({ read_at: new Date().toISOString() }).in("id", ids);
      setPending(items => items.filter(item => item.request_id !== requestId));
    }
    setLatest(null);
    onOpen(requestId);
  }

  async function enableNotifications() {
    if ("Notification" in window) await Notification.requestPermission();
  }

  return (
    <>
      {showBubble && <button type="button" className="message-bubble" aria-label={`${pending.length} mensajes pendientes`} onClick={() => {
        if (pending[0]) openConversation(pending[0].request_id);
        else {
          enableNotifications();
          onOpen(null);
        }
      }}>
        💬{pending.length > 0 && <span>{pending.length > 99 ? "99+" : pending.length}</span>}
      </button>}
      {latest && <button type="button" className="message-toast" onClick={() => openConversation(latest.request_id)}>
        <span>💬</span><div><b>Nuevo mensaje</b><p>{latest.message || "Te enviaron una fotografía."}</p></div><i>Ver</i>
      </button>}
    </>
  );
}

export default MessageNotifications;
