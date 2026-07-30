import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function ClientDashboard() {
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    async function cargarCliente() {
      const {
        data: { user },
        error: usuarioError,
      } = await supabase.auth.getUser();

      if (usuarioError || !user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, role")
        .eq("id", user.id)
        .single();

      if (error) {
        setMensaje(`No se pudo cargar el perfil: ${error.message}`);
        setCargando(false);
        return;
      }

      if (data.role === "admin") {
        navigate("/admin");
        return;
      }

      setPerfil(data);
      setCargando(false);
    }

    cargarCliente();
  }, [navigate]);

  async function cerrarSesion() {
    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      setMensaje(`No se pudo cerrar la sesión: ${error.message}`);
      return;
    }

    navigate("/login");
  }

  if (cargando) {
    return <p className="dashboard-loading">Cargando panel...</p>;
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-brand">SecureHome IoT</p>
          <h1>Hola, {perfil?.full_name || "Cliente"} 👋</h1>
          <p>Controla el estado de tu sistema de seguridad.</p>
        </div>

        <button className="logout-button" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      {mensaje && <p className="dashboard-message">{mensaje}</p>}

      <section className="status-banner">
        <div>
          <span className="status-dot"></span>
          <strong>Sistema pendiente de instalación</strong>
        </div>

        <span>Servicio registrado</span>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <span className="dashboard-icon">📷</span>
          <h2>Cámara</h2>
          <p>Aún no hay una cámara vinculada.</p>
          <span className="device-status pending">Pendiente</span>
        </article>

        <article className="dashboard-card">
          <span className="dashboard-icon">🚨</span>
          <h2>Sensores</h2>
          <p>Aún no hay sensores vinculados.</p>
          <span className="device-status pending">Pendiente</span>
        </article>

        <article className="dashboard-card">
          <span className="dashboard-icon">📱</span>
          <h2>Telegram</h2>
          <p>Configura las alertas instantáneas.</p>
          <button className="card-button">Configurar</button>
        </article>

        <article className="dashboard-card">
          <span className="dashboard-icon">🔑</span>
          <h2>Tarjetas NFC</h2>
          <p>No existen tarjetas registradas.</p>
          <span className="device-status pending">0 tarjetas</span>
        </article>
      </section>

      <section className="events-section">
        <div className="events-heading">
          <div>
            <h2>Últimos eventos</h2>
            <p>Actividad reciente del sistema.</p>
          </div>
        </div>

        <div className="empty-events">
          <span>🛡️</span>
          <h3>No existen eventos todavía</h3>
          <p>Los movimientos, accesos y alertas aparecerán aquí.</p>
        </div>
      </section>
    </main>
  );
}

export default ClientDashboard;