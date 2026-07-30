import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import RequestChat from "../components/RequestChat";
import AdminAppointments from "../components/AdminAppointments";
import AdminCameraAccess from "../components/AdminCameraAccess";

const labels = { pending: "Pendiente", contacted: "Contactado", scheduled: "Programado", installed: "Instalado", cancelled: "Cancelado" };

function AdminDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [chatRequest, setChatRequest] = useState(null);
  const [cameraRequest, setCameraRequest] = useState(null);

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
    } else setMessage("Estado actualizado correctamente.");
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const installed = requests.filter(item => item.status === "installed").length;
  const pending = requests.filter(item => !item.status || item.status === "pending").length;

  return (
    <main className="admin-page">
      <header className="dashboard-header">
        <div><Link className="dashboard-brand dashboard-brand-link" to="/">SecureHome IoT · Administración</Link><h1>Solicitudes de servicio</h1><p>Gestiona clientes e instalaciones desde un solo lugar.</p></div>
        <button className="logout-button" type="button" onClick={logout}>Cerrar sesión</button>
      </header>
      {message && <p className="dashboard-message" role="status">{message}</p>}
      <section className="admin-summary">
        <article className="summary-card"><span>Solicitudes totales</span><b>{requests.length}</b></article>
        <article className="summary-card"><span>Pendientes</span><b>{pending}</b></article>
        <article className="summary-card"><span>Instalaciones completas</span><b>{installed}</b></article>
      </section>
      <AdminAppointments />
      <section className="admin-table-wrap">
        {loading ? <div className="dashboard-message">Cargando solicitudes...</div> : requests.length === 0 ? <div className="empty-events"><h3>No hay solicitudes todavía</h3><p>Las nuevas solicitudes aparecerán aquí.</p></div> :
          <table className="admin-table">
            <thead><tr><th>Cliente</th><th>Plan</th><th>Propiedad</th><th>Dirección</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{requests.map(item => <tr key={item.id}>
              <td><b>{item.profiles?.full_name || "Sin nombre"}</b><br/><small>{item.profiles?.phone || "Sin teléfono"}</small></td>
              <td>{item.service_plans?.name || "Sin plan"}</td><td>{item.property_type}</td><td>{item.installation_address}</td>
              <td>{new Intl.DateTimeFormat("es-EC").format(new Date(item.created_at))}</td>
              <td><select aria-label={`Estado de ${item.profiles?.full_name || "cliente"}`} value={item.status || "pending"} onChange={e => updateStatus(item.id, e.target.value)}>{Object.entries(labels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></td>
              <td><div className="table-actions"><button type="button" className="table-chat-button" onClick={() => setChatRequest(item)}>Chat</button><button type="button" className="table-camera-button" onClick={() => setCameraRequest(item)}>Cámara</button></div></td>
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
    </main>
  );
}

export default AdminDashboard;
