import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function ClientDashboard() {
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState(null);
  const [solicitud, setSolicitud] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [dialogo, setDialogo] = useState(null);

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
            name,
            price
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

  const acciones = {
    camera: { titulo: "Cámara en vivo", texto: "La transmisión se abrirá cuando la cámara asignada esté conectada. Si ya fue instalada y no aparece, contacta a soporte.", accion: "Entendido" },
    sensors: { titulo: "Estado de sensores", texto: "Tus sensores se encuentran vinculados al sistema. Las alertas de movimiento se enviarán por el canal configurado.", accion: "Entendido" },
    telegram: { titulo: "Configurar Telegram", texto: "La vinculación requiere el código entregado durante la instalación. Abre el bot indicado en tu guía y envía ese código para activar las alertas.", accion: "Entendido" },
    nfc: { titulo: "Tarjetas NFC", texto: "Por seguridad, las tarjetas se activan presencialmente. Solicita una nueva tarjeta al técnico asignado a tu instalación.", accion: "Entendido" },
  };

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
          <p className="dashboard-brand">SecureHome IoT</p>
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

              {solicitud.service_plans?.price != null && (
                <strong>
                  ${Number(solicitud.service_plans.price).toFixed(2)}
                </strong>
              )}
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

          {solicitud.status === "installed" && (
            <section className="events-section">
              <div className="events-heading">
                <div>
                  <h2>Dispositivos</h2>
                  <p>Equipos vinculados al sistema.</p>
                </div>
              </div>

              <div className="dashboard-grid">
                <article className="dashboard-card">
                  <span className="dashboard-icon">📷</span>
                  <h2>Cámara</h2>
                  <p>Consulta la transmisión del sistema.</p>
                  <button type="button" className="card-button" onClick={() => setDialogo(acciones.camera)}>
                    Ver cámara
                  </button>
                </article>

                <article className="dashboard-card">
                  <span className="dashboard-icon">🚨</span>
                  <h2>Sensores</h2>
                  <p>Consulta el estado de los sensores.</p>
                  <button type="button" className="card-button" onClick={() => setDialogo(acciones.sensors)}>
                    Ver sensores
                  </button>
                </article>

                <article className="dashboard-card">
                  <span className="dashboard-icon">📱</span>
                  <h2>Telegram</h2>
                  <p>Configura las alertas instantáneas.</p>
                  <button type="button" className="card-button" onClick={() => setDialogo(acciones.telegram)}>
                    Configurar
                  </button>
                </article>

                <article className="dashboard-card">
                  <span className="dashboard-icon">🔑</span>
                  <h2>Tarjetas NFC</h2>
                  <p>Administra las tarjetas autorizadas.</p>
                  <button type="button" className="card-button" onClick={() => setDialogo(acciones.nfc)}>
                    Administrar
                  </button>
                </article>
              </div>
            </section>
          )}
          <dialog className="device-dialog" open={Boolean(dialogo)} onCancel={() => setDialogo(null)}>
            {dialogo && <div className="dialog-body">
              <div className="dialog-heading"><h2>{dialogo.titulo}</h2><button type="button" className="dialog-close" aria-label="Cerrar" onClick={() => setDialogo(null)}>×</button></div>
              <p>{dialogo.texto}</p>
              <button type="button" className="dialog-action" onClick={() => { if (dialogo.enlace) window.open(dialogo.enlace, "_blank", "noopener,noreferrer"); setDialogo(null); }}>{dialogo.accion}</button>
            </div>}
          </dialog>
        </>
      )}
    </main>
  );
}

export default ClientDashboard;
