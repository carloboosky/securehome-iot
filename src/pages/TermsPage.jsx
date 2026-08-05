import { Link } from "react-router-dom";

function TermsPage() {
  return <main className="terms-page">
    <article className="terms-card">
      <Link className="auth-brand" to="/"><span className="brand-mark">S</span><span>SecureHome</span></Link>
      <span className="form-step">Información contractual</span>
      <h1>Términos y condiciones del servicio</h1>
      <p className="terms-updated">Condiciones aplicables a los planes Esencial, Protección Plus y Total.</p>

      <section><h2>1. Permanencia mínima</h2><p>Al contratar cualquier plan de SecureHome IoT, el cliente acepta mantener activo el servicio durante un periodo mínimo obligatorio de cuatro meses consecutivos contados desde la activación del sistema.</p></section>
      <section><h2>2. Pagos del plan</h2><p>El cliente deberá pagar el valor inicial del plan seleccionado y su suscripción mensual correspondiente: Esencial $3.50, Protección Plus $4.50 o Total $6.00. Los pagos mensuales se generan durante todo el periodo contratado.</p></section>
      <section><h2>3. Equipos y fabricación</h2><p>Los equipos incluidos corresponden a la descripción vigente de cada plan. El diseño de carcasa seleccionado está sujeto a revisión técnica y disponibilidad de fabricación. La Araña Robótica tiene un recargo adicional de $85.</p></section>
      <section><h2>4. Instalación y conectividad</h2><p>El funcionamiento de cámaras, sensores, NFC, página web y Telegram depende de una conexión eléctrica y de internet estable. La ubicación final de los dispositivos se confirmará durante la instalación.</p></section>
      <section><h2>5. Cancelación anticipada</h2><p>Si el cliente solicita cancelar antes de completar los cuatro meses mínimos, deberá cancelar los valores mensuales pendientes del periodo obligatorio, salvo que exista una causa legal o técnica acordada con SecureHome.</p></section>
      <section><h2>6. Privacidad y acceso</h2><p>El cliente es responsable de proteger sus credenciales y códigos temporales. SecureHome solicitará autorización temporal cuando el personal administrativo necesite acceder a una cámara para soporte.</p></section>

      <Link className="btn-link btn-primary terms-return" to="/registro">Volver al registro</Link>
    </article>
  </main>;
}

export default TermsPage;
