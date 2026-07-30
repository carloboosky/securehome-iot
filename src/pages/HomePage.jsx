import { useState } from "react";
import { Link } from "react-router-dom";
import heroImage from "../assets/hero.png";

const services = [
  ["camera", "Monitoreo en vivo", "Visualiza tus cámaras en alta definición desde cualquier lugar y en cualquier momento."],
  ["sensor", "Detección inteligente", "Sensores que identifican actividad inusual y reducen falsas alarmas."],
  ["bell", "Alertas al instante", "Recibe fotografías y avisos en Telegram cuando ocurre un evento importante."],
  ["key", "Acceso NFC", "Controla el armado y desarmado mediante tarjetas seguras y fáciles de administrar."],
];

const plans = [
  { name: "Esencial", price: "24", text: "Para departamentos y espacios pequeños", features: ["1 cámara HD", "2 sensores", "Alertas Telegram"] },
  { name: "Protección Plus", price: "39", text: "La protección ideal para tu hogar", features: ["2 cámaras HD", "4 sensores", "NFC + Telegram"], featured: true },
  { name: "Total", price: "59", text: "Cobertura completa para hogares y negocios", features: ["4 cámaras HD", "8 sensores", "Soporte prioritario"] },
];

function Icon({ name }) {
  const paths = {
    camera: <><rect x="3" y="6" width="18" height="13" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.2-2h5.6L16 6"/></>,
    sensor: <><path d="M12 3v2M5.6 5.6 7 7M3 12h2M19 12h2M17 7l1.4-1.4"/><path d="M8 16a5.7 5.7 0 0 1 8 0M10 19a2.8 2.8 0 0 1 4 0"/><circle cx="12" cy="21" r=".5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="home-page">
      <header className="navbar">
        <a className="brand" href="#inicio" onClick={closeMenu} aria-label="SecureHome inicio">
          <span className="brand-mark">S</span><span>SecureHome</span>
        </a>
        <button className="menu-toggle" type="button" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span/><span/><span/>
        </button>
        <nav className={menuOpen ? "nav-open" : ""} aria-label="Navegación principal">
          <a href="#inicio" onClick={closeMenu}>Inicio</a>
          <a href="#servicios" onClick={closeMenu}>Servicios</a>
          <a href="#planes" onClick={closeMenu}>Planes</a>
          <a href="#contacto" onClick={closeMenu}>Contacto</a>
        </nav>
        <div className="nav-buttons">
          <Link className="btn-link btn-ghost" to="/login">Iniciar sesión</Link>
          <Link className="btn-link btn-primary" to="/registro">Proteger mi hogar</Link>
        </div>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <span className="eyebrow"><i/> Seguridad inteligente 24/7</span>
            <h1>Tu hogar seguro.<br/><span>Siempre conectado.</span></h1>
            <p>Protección inteligente con cámaras, sensores y alertas instantáneas. Controla todo desde donde estés.</p>
            <div className="hero-actions">
              <Link className="btn-link btn-primary btn-large" to="/registro">Solicitar instalación <span>→</span></Link>
              <a className="btn-link btn-light btn-large" href="#servicios">Conocer el sistema</a>
            </div>
            <div className="trust-row">
              <span><Icon name="check"/> Instalación profesional</span>
              <span><Icon name="check"/> Soporte local</span>
              <span><Icon name="check"/> Sin permanencia</span>
            </div>
          </div>
          <div className="hero-visual">
            <img src={heroImage} alt="Sistema de seguridad inteligente instalado en un hogar" />
            <div className="status-float"><span className="status-icon">✓</span><div><b>Sistema protegido</b><small>Todos los dispositivos activos</small></div></div>
            <div className="live-pill"><i/> EN VIVO</div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Beneficios">
          <div><b>24/7</b><span>Monitoreo continuo</span></div>
          <div><b>&lt; 3 seg</b><span>Alertas instantáneas</span></div>
          <div><b>100%</b><span>Control desde tu móvil</span></div>
          <div><b>Soporte</b><span>Atención personalizada</span></div>
        </section>

        <section className="section services" id="servicios">
          <div className="section-heading"><span className="eyebrow">Protección completa</span><h2>Todo lo que necesitas para sentirte seguro</h2><p>Tecnología confiable, fácil de usar y diseñada para proteger lo que más te importa.</p></div>
          <div className="cards">
            {services.map(([icon, title, text]) => <article className="card" key={title}><span className="service-icon"><Icon name={icon}/></span><h3>{title}</h3><p>{text}</p><Link to="/registro">Quiero este servicio <span>→</span></Link></article>)}
          </div>
        </section>

        <section className="section plans" id="planes">
          <div className="section-heading"><span className="eyebrow">Planes transparentes</span><h2>Elige la protección que necesitas</h2><p>Instalación profesional y acompañamiento incluidos.</p></div>
          <div className="plan-grid">
            {plans.map(plan => <article className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
              {plan.featured && <span className="popular">Más elegido</span>}
              <h3>{plan.name}</h3><p>{plan.text}</p><div className="price"><small>Desde</small><b>${plan.price}</b><span>/mes</span></div>
              <ul>{plan.features.map(feature => <li key={feature}><Icon name="check"/>{feature}</li>)}</ul>
              <Link className={`btn-link ${plan.featured ? "btn-primary" : "btn-outline"}`} to="/registro">Elegir plan</Link>
            </article>)}
          </div>
        </section>

        <section className="cta" id="contacto">
          <div><span className="eyebrow">Estamos para ayudarte</span><h2>¿Listo para sentirte más seguro?</h2><p>Cuéntanos qué necesitas. Nuestro equipo te ayudará a elegir la solución adecuada para tu espacio.</p></div>
          <div className="cta-actions"><Link className="btn-link btn-white btn-large" to="/registro">Solicitar asesoría →</Link><span>Te contactaremos para una evaluación personalizada</span></div>
        </section>
      </main>

      <footer>
        <a className="brand" href="#inicio"><span className="brand-mark">S</span><span>SecureHome</span></a>
        <p>Seguridad inteligente para hogares y negocios en Ecuador.</p>
        <div><a href="#servicios">Servicios</a><a href="#planes">Planes</a><Link to="/login">Área de clientes</Link></div>
        <small>© {new Date().getFullYear()} SecureHome IoT. Todos los derechos reservados.</small>
      </footer>
    </div>
  );
}

export default HomePage;
