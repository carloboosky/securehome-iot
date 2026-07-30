import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import SecurityCenter from "../components/SecurityCenter";
import RequestChat from "../components/RequestChat";
import AppointmentScheduler from "../components/AppointmentScheduler";
import MessageNotifications from "../components/MessageNotifications";

function ClientDashboard() {
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState(null);
  const [solicitud, setSolicitud] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [actualizacion, setActualizacion] = useState("");

  useEffect(() => {
    async function cargarCliente() {
      try {
        const {
          data: { user },
          error: usuarioError,
        } = await supabase.auth.getUser();

        if (usuarioError || !user) {
          navigate("/login", { replace: true });
          return;
        }

        const { data: perfilData, error: perfilError } = await supabase
          .from("profiles")
          .select("id, full_name, phone, role")
          .eq("id", user.id)
          .single();

        if (perfilError) {
          throw new Error(
            `No se pudo cargar el perfil: ${perfilError.message}`
          );
        }

        if (perfilData.role === "admin") {
          navigate("/admin", { replace: true });
          return;
        }

        setPerfil(perfilData);

        const { data: solicitudData, error: solicitudError } = await supabase
          .from("service_requests")
          .select(`
           id,
            status,
            property_type,
            installation_address,
            notes,
            created_at,
            service_plans(
            name
            )
          `)
          .eq("client_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (solicitudError) {
          throw new Error(
            `No se pudo cargar la solicitud: ${solicitudError.message}`
          );
        }

        setSolicitud(solicitudData);
      } catch (error) {
        setMensaje(error.message);
      } finally {
        setCargando(false);
      }
    }

    cargarCliente();
  }, [navigate]);

  useEffect(() => {
    if (!solicitud?.id) return undefined;

    const channel = supabase
      .channel(`request-status-${solicitud.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "service_requests",
        filter: `id=eq.${solicitud.id}`,
      }, payload => {
        setSolicitud(previous => ({ ...previous, ...payload.new }));
        setActualizacion(
          `Tu solicitud cambió a: ${obtenerEstado(payload.new.status)}.`
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [solicitud?.id]);

  async function cerrarSesion() {
    setMensaje("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMensaje(`No se pudo cerrar la sesión: ${error.message}`);
      return;
    }

    navigate("/login", { replace: true });
  }

  function obtenerEstado(estado) {
    const estados = {
      pending: "Pendiente",
      contacted: "Contactado",
      scheduled: "Programado",
      installed: "Instalado",
      cancelled: "Cancelado",
    };

    return estados[estado] || estado || "Pendiente";
  }

  function formatearFecha(fecha) {
    if (!fecha) return "Sin fecha";

    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(fecha));
  }

  if (cargando) {
    return (
      <main className="dashboard-loading-container">
        <div className="dashboard-loader"></div>
        <p>Cargando panel...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <Link className="dashboard-brand dashboard-brand-link" to="/">SecureHome IoT</Link>
          <h1>Hola, {perfil?.full_name || "Cliente"} 👋</h1>
          <p>Consulta el estado de tu servicio de seguridad.</p>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={cerrarSesion}
        >
          Cerrar sesión
        </button>
      </header>

      {mensaje && (
        <div className="dashboard-message error-message">
          {mensaje}
        </div>
      )}
      {actualizacion && (
        <div className="realtime-notice" role="status">
          <span>✓</span>
          <div><b>Actualización en tiempo real</b><p>{actualizacion}</p></div>
          <button type="button" aria-label="Cerrar notificación" onClick={() => setActualizacion("")}>×</button>
        </div>
      )}
      {solicitud && <MessageNotifications role="client" onOpen={() => {
        document.querySelector(".chat-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }} />}

      {!solicitud ? (
        <section className="empty-request">
          <span className="empty-request-icon">🏠</span>
          <h2>No tienes una solicitud registrada</h2>
          <p>
            Primero debes completar la información del servicio que deseas
            instalar.
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={() => navigate("/completar-registro")}
          >
            Solicitar instalación
          </button>
        </section>
      ) : (
        <>
          <section className="status-banner">
            <div>
              <span className="status-dot"></span>

              <div>
                <strong>
                  Estado: {obtenerEstado(solicitud.status)}
                </strong>

                <p>
                  Solicitud creada el{" "}
                  {formatearFecha(solicitud.created_at)}
                </p>
              </div>
            </div>

            <span className={`request-status ${solicitud.status}`}>
              {obtenerEstado(solicitud.status)}
            </span>
          </section>

          <section className="dashboard-grid">
            <article className="dashboard-card">
              <span className="dashboard-icon">🛡️</span>
              <h2>Plan contratado</h2>

              <p>
                {solicitud.service_plans?.name ||
                  "Plan no especificado"}
              </p>

            </article>

            <article className="dashboard-card">
              <span className="dashboard-icon">🏠</span>
              <h2>Tipo de propiedad</h2>

              <p>
                {solicitud.property_type || "No especificado"}
              </p>
            </article>

            <article className="dashboard-card">
              <span className="dashboard-icon">📍</span>
              <h2>Dirección</h2>

              <p>{solicitud.installation_address || "No especificada"}</p>
            </article>

            <article className="dashboard-card">
              <span className="dashboard-icon">📞</span>
              <h2>Teléfono</h2>

              <p>{perfil?.phone || "No registrado"}</p>
            </article>
          </section>

          <section className="events-section">
            <div className="events-heading">
              <div>
                <h2>Detalles de la solicitud</h2>
                <p>Información proporcionada para la instalación.</p>
              </div>
            </div>

            <div className="request-details">
              <div>
                <span>Estado</span>
                <strong>
                  {obtenerEstado(solicitud.status)}
                </strong>
              </div>

              <div>
                <span>Fecha</span>
                <strong>
                  {formatearFecha(solicitud.created_at)}
                </strong>
              </div>

              <div>
                <span>Notas</span>
                <strong>
                  {solicitud.notes || "Sin notas adicionales"}
                </strong>
              </div>
            </div>
          </section>

          <section className="events-section chat-section">
            <RequestChat requestId={solicitud.id} role="client" />
          </section>

          {solicitud.status !== "cancelled" && (
            <AppointmentScheduler requestId={solicitud.id} />
          )}

          {solicitud.status === "installed" && (
            <SecurityCenter requestId={solicitud.id} />
          )}
        </>
      )}
    </main>
  );
}

export default ClientDashboard;
