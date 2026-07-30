import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import RequestChat from "../components/RequestChat";
import AdminAppointments from "../components/AdminAppointments";
import AdminCameraAccess from "../components/AdminCameraAccess";
import MessageNotifications from "../components/MessageNotifications";
import { sendAutomaticMessage } from "../lib/sendAutomaticMessage";

const labels = { pending: "Pendiente", contacted: "Contactado", scheduled: "Programado", installed: "Instalado", cancelled: "Cancelado" };
const automaticStatusMessages = {
  pending: "🕒 Tu solicitud está pendiente de revisión. Te avisaremos cuando un asesor empiece a gestionarla.",
  contacted: "📞 Tu solicitud cambió a Contactado. Un asesor de SecureHome se comunicará contigo.",
  scheduled: "📅 Tu solicitud fue programada. Revisa la sección de instalación para consultar o elegir la fecha de la visita.",
  installed: "✅ Tu sistema figura como instalado. Ya puedes utilizar las funciones de seguridad disponibles en tu panel.",
  cancelled: "❌ Tu solicitud fue cancelada. Si necesitas ayuda o deseas retomarla, escríbenos por este chat.",
};

function AdminDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [chatRequest, setChatRequest] = useState(null);
  const [cameraRequest, setCameraRequest] = useState(null);
  const [unreadByRequest, setUnreadByRequest] = useState({});
  const [selectedRequestIds, setSelectedRequestIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [clientDetails, setClientDetails] = useState(null);
  const [clientDetailsLoading, setClientDetailsLoading] = useState(false);

  useEffect(() => {
    if (!chatRequest && !cameraRequest && !clientDetailsLoading && !clientDetails) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [chatRequest, cameraRequest, clientDetails, clientDetailsLoading]);

  useEffect(() => {
    let active = true;

    function refreshUnread() {
      return supabase.from("service_messages")
        .select("request_id")
        .eq("sender_role", "client")
        .is("read_at", null)
        .then(({ data }) => {
          if (!active) return;
          setUnreadByRequest((data || []).reduce((counts, item) => ({
            ...counts,
            [item.request_id]: (counts[item.request_id] || 0) + 1,
          }), {}));
        });
    }

    refreshUnread();

    const channel = supabase.channel("admin-unread-by-request")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "service_messages",
      }, payload => {
        if (payload.new.sender_role !== "client") return;
        refreshUnread();
      }).subscribe();
    const polling = window.setInterval(refreshUnread, 3000);

    return () => {
      active = false;
      window.clearInterval(polling);
      supabase.removeChannel(channel);
    };
  }, []);

  async function abrirChat(request) {
    setChatRequest(request);
    setUnreadByRequest(counts => ({ ...counts, [request.id]: 0 }));
    await supabase.from("service_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("request_id", request.id)
      .eq("sender_role", "client")
      .is("read_at", null);
  }

  async function openClientDetails(request) {
    setClientDetailsLoading(true);
    setClientDetails({ fallback: request });
    const { data, error } = await supabase.rpc("get_client_registration_details", {
      target_request_id: request.id,
    });
    if (error) {
      setMessage(`No se pudo cargar toda la ficha: ${error.message}`);
      setClientDetails({ fallback: request, loadError: true });
    } else {
      setClientDetails(data);
    }
    setClientDetailsLoading(false);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/login", { replace: true });
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role !== "admin") return navigate("/dashboard", { replace: true });
      const { data, error } = await supabase.from("service_requests")
        .select("id,status,property_type,installation_address,created_at,profiles(full_name,phone),service_plans(name)")
        .order("created_at", { ascending: false });
      if (error) setMessage(`No se pudieron cargar las solicitudes: ${error.message}`);
      else setRequests(data || []);
      setLoading(false);
    }
    load();
  }, [navigate]);

  async function updateStatus(id, status) {
    setMessage("");
    const previous = requests;
    setRequests(items => items.map(item => item.id === id ? { ...item, status } : item));
    const { error } = await supabase.from("service_requests").update({ status }).eq("id", id);
    if (error) {
      setRequests(previous);
      setMessage(`No se pudo actualizar: ${error.message}`);
      return;
    }

    const { error: messageError } = await sendAutomaticMessage(id, automaticStatusMessages[status]);
    setMessage(
      messageError
        ? `Estado actualizado, pero no se pudo enviar el mensaje automático: ${messageError.message}`
        : `Estado actualizado a ${labels[status]}. El cliente recibió un mensaje automático.`
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  function toggleRequestSelection(id) {
    setSelectedRequestIds(ids => ids.includes(id)
      ? ids.filter(item => item !== id)
      : [...ids, id]);
  }

  async function deleteSelectedRequests() {
    if (selectedRequestIds.length === 0 || deleting) return;
    const selectedNames = requests
      .filter(item => selectedRequestIds.includes(item.id))
      .map(item => item.profiles?.full_name || "Cliente")
      .join(", ");
    const confirmed = window.confirm(
      `¿Eliminar ${selectedRequestIds.length} solicitud(es)?\n\n${selectedNames}\n\nSe borrarán también sus citas, mensajes y configuración de cámara. La cuenta de acceso del usuario se conservará.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    const { data: deletedCount, error } = await supabase.rpc("delete_service_requests", {
      selected_request_ids: selectedRequestIds,
    });
    if (error) {
      setMessage(`No se pudieron eliminar las solicitudes: ${error.message}`);
    } else {
      setRequests(items => items.filter(item => !selectedRequestIds.includes(item.id)));
      setMessage(`${deletedCount} solicitud(es) eliminada(s) del panel.`);
      setSelectedRequestIds([]);
    }
    setDeleting(false);
  }

  const installed = requests.filter(item => item.status === "installed").length;
  const pending = requests.filter(item => !item.status || item.status === "pending").length;

  return (
    <main className="admin-page">
      <header className="dashboard-header">
        <div><Link className="dashboard-brand dashboard-brand-link" to="/">SecureHome IoT · Administración</Link><h1>Solicitudes de servicio</h1><p>Gestiona clientes e instalaciones desde un solo lugar.</p></div>
        <div className="dashboard-header-actions"><Link className="home-button" to="/">⌂ Página principal</Link><button className="logout-button" type="button" onClick={logout}>Cerrar sesión</button></div>
      </header>
      {message && <p className="dashboard-message" role="status">{message}</p>}
      <MessageNotifications role="admin" showBubble={false} onOpen={requestId => {
        const request = requests.find(item => item.id === requestId);
        if (request) abrirChat(request);
      }} />
      <section className="admin-summary">
        <article className="summary-card"><span>Solicitudes totales</span><b>{requests.length}</b></article>
        <article className="summary-card"><span>Pendientes</span><b>{pending}</b></article>
        <article className="summary-card"><span>Instalaciones completas</span><b>{installed}</b></article>
      </section>
      <AdminAppointments requests={requests} />
      <section className="admin-table-wrap">
        {selectedRequestIds.length > 0 && <div className="admin-delete-toolbar">
          <span><b>{selectedRequestIds.length}</b> cliente(s) seleccionado(s)</span>
          <button type="button" onClick={deleteSelectedRequests} disabled={deleting}>{deleting ? "Eliminando..." : "Eliminar seleccionados"}</button>
        </div>}
        {loading ? <div className="dashboard-message">Cargando solicitudes...</div> : requests.length === 0 ? <div className="empty-events"><h3>No hay solicitudes todavía</h3><p>Las nuevas solicitudes aparecerán aquí.</p></div> :
          <table className="admin-table">
            <thead><tr><th>Cliente</th><th>Plan</th><th>Propiedad</th><th>Dirección</th><th>Fecha</th><th>Estado</th><th>Acciones</th><th className="delete-column"><label className="delete-checkbox" title="Seleccionar todos"><input type="checkbox" checked={requests.length > 0 && selectedRequestIds.length === requests.length} onChange={event => setSelectedRequestIds(event.target.checked ? requests.map(item => item.id) : [])}/><span>✓</span></label></th></tr></thead>
            <tbody>{requests.map(item => <tr key={item.id}>
              <td><button type="button" className="client-name-button" onClick={() => openClientDetails(item)}><b>{item.profiles?.full_name || "Sin nombre"}</b><small>{item.profiles?.phone || "Sin teléfono"}</small><i>Ver ficha →</i></button></td>
              <td>{item.service_plans?.name || "Sin plan"}</td><td>{item.property_type}</td><td>{item.installation_address}</td>
              <td>{new Intl.DateTimeFormat("es-EC").format(new Date(item.created_at))}</td>
              <td><select aria-label={`Estado de ${item.profiles?.full_name || "cliente"}`} value={item.status || "pending"} onChange={e => updateStatus(item.id, e.target.value)}>{Object.entries(labels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></td>
              <td><div className="table-actions"><button type="button" className="table-details-button" onClick={() => openClientDetails(item)}>Datos</button><button type="button" className="table-chat-button" onClick={() => abrirChat(item)}>Chat{unreadByRequest[item.id] > 0 && <span className="row-unread-badge">{unreadByRequest[item.id] > 99 ? "99+" : unreadByRequest[item.id]}</span>}</button><button type="button" className="table-camera-button" onClick={() => setCameraRequest(item)}>Cámara</button></div></td>
              <td className="delete-column"><label className="delete-checkbox" title={`Seleccionar a ${item.profiles?.full_name || "cliente"} para eliminar`}><input type="checkbox" checked={selectedRequestIds.includes(item.id)} onChange={() => toggleRequestSelection(item.id)}/><span>✓</span></label></td>
            </tr>)}</tbody>
          </table>}
      </section>
      {chatRequest && <div className="chat-modal-backdrop" role="presentation" onMouseDown={event => {
        if (event.target === event.currentTarget) setChatRequest(null);
      }}>
        <section className="chat-modal" role="dialog" aria-modal="true" aria-label="Chat con el cliente">
          <div className="chat-modal-title"><div><b>{chatRequest.profiles?.full_name || "Cliente"}</b><span>{chatRequest.installation_address}</span></div><button type="button" aria-label="Cerrar chat" onClick={() => setChatRequest(null)}>×</button></div>
          <RequestChat requestId={chatRequest.id} role="admin" />
        </section>
      </div>}
      {cameraRequest && <AdminCameraAccess request={cameraRequest} onClose={() => setCameraRequest(null)} />}
      {clientDetails && <div className="chat-modal-backdrop" role="presentation" onMouseDown={event => {
        if (event.target === event.currentTarget) setClientDetails(null);
      }}>
        <section className="client-profile-modal" role="dialog" aria-modal="true" aria-label="Ficha del cliente">
          <div className="chat-modal-title"><div><b>Ficha del cliente</b><span>Información proporcionada durante el registro</span></div><button type="button" aria-label="Cerrar ficha" onClick={() => setClientDetails(null)}>×</button></div>
          {clientDetailsLoading ? <div className="client-profile-loading"><div className="dashboard-loader"/><p>Cargando información...</p></div> : (() => {
            const fallback = clientDetails.fallback;
            const details = clientDetails.loadError ? {
              full_name: fallback?.profiles?.full_name,
              phone: fallback?.profiles?.phone,
              plan_name: fallback?.service_plans?.name,
              property_type: fallback?.property_type,
              installation_address: fallback?.installation_address,
              status: fallback?.status,
              created_at: fallback?.created_at,
            } : clientDetails;
            const propertyLabels = { house: "Casa", apartment: "Departamento", business: "Negocio", office: "Oficina" };
            return <div className="client-profile-body">
              <div className="client-profile-heading"><span>{details.full_name?.charAt(0).toUpperCase() || "C"}</span><div><h2>{details.full_name || "Cliente sin nombre"}</h2><p>{details.email || "Correo no disponible"}</p></div></div>
              <div className="client-profile-grid">
                <div><span>Teléfono</span><b>{details.phone || "No registrado"}</b></div>
                <div><span>Plan solicitado</span><b>{details.plan_name || "No especificado"}</b></div>
                <div><span>Tipo de propiedad</span><b>{propertyLabels[details.property_type] || details.property_type || "No especificado"}</b></div>
                <div><span>Estado</span><b>{labels[details.status] || details.status || "Pendiente"}</b></div>
                <div className="wide"><span>Dirección de instalación</span><b>{details.installation_address || "No registrada"}</b></div>
                <div className="wide"><span>Fecha de registro</span><b>{details.created_at ? new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short" }).format(new Date(details.created_at)) : "No disponible"}</b></div>
              </div>
              <div className="client-household-details"><span>Datos del hogar e información adicional</span><pre>{details.notes || "No se proporcionaron detalles adicionales."}</pre></div>
              <p className="password-privacy-note">🔒 La contraseña nunca se muestra ni se almacena como texto visible.</p>
            </div>;
          })()}
        </section>
      </div>}
    </main>
  );
}

export default AdminDashboard;
