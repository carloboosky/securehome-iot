import { Link } from "react-router-dom";

function HomePage() {
  return (
    <>
      <header className="navbar">
        <h2>🔒 SecureHome IoT</h2>

        <nav>
          <a href="#inicio">Inicio</a>
          <a href="#servicios">Servicios</a>
          <a href="#planes">Planes</a>
          <a href="#contacto">Contacto</a>
        </nav>

        <div className="nav-buttons">
          <Link to="/login">
            <button className="btn-secondary">
              Iniciar sesión
            </button>
          </Link>

          <Link to="/registro">
            <button className="btn-primary">
              Registrarse
            </button>
          </Link>
        </div>
      </header>

      <section className="hero" id="inicio">
        <div>
          <h1>Protegemos lo que más importa.</h1>

          <p>
            Sistema inteligente de seguridad con cámaras,
            sensores, Telegram y acceso mediante NFC.
          </p>

          <Link to="/registro">
            <button className="btn-primary">
              Solicitar instalación
            </button>
          </Link>
        </div>

        <img
          src="https://images.unsplash.com/photo-1558002038-1055907df827?w=900"
          alt="Seguridad"
        />
      </section>
    <section className="services" id="servicios">
  <h2>Nuestros Servicios</h2>

  <div className="cards">

    <div className="card">
      <div className="icon">📷</div>
      <h3>Monitoreo en Vivo</h3>
      <p>
        Visualiza tus cámaras desde cualquier lugar con transmisión en tiempo
        real.
      </p>
    </div>

    <div className="card">
      <div className="icon">🚨</div>
      <h3>Detección de Movimiento</h3>
      <p>
        Sensores PIR que detectan movimiento y generan alertas instantáneas.
      </p>
    </div>

    <div className="card">
      <div className="icon">📱</div>
      <h3>Alertas por Telegram</h3>
      <p>
        Recibe fotografías y notificaciones inmediatamente cuando ocurre un
        evento.
      </p>
    </div>

    <div className="card">
      <div className="icon">🔑</div>
      <h3>Acceso NFC</h3>
      <p>
        Controla el armado y desarmado del sistema mediante tarjetas NFC.
      </p>
    </div>

  </div>
</section>

    </>
  );
}

export default HomePage;