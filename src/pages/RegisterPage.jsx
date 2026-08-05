import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function RegisterPage() {
  const navigate = useNavigate();

  const [planes, setPlanes] = useState([]);

  const [formulario, setFormulario] = useState({
    nombre: "",
    telefono: "",
    correo: "",
    password: "",
    confirmarPassword: "",
    planId: "",
    tipoPropiedad: "house",
    direccion: "",
    cantidadMascotas: "0",
    tamanoMascotas: "none",
    integrantesHogar: "1",
    menoresTrece: "0",
    notas: "",
    aceptaTerminos: false,
  });

  const [errores, setErrores] = useState({});
  const [mensajeGeneral, setMensajeGeneral] = useState("");
  const [cargando, setCargando] = useState(false);

  function validarCampo(name, datos) {
    const valor = datos[name];

    if (name === "nombre") {
      if (!valor.trim()) return "El nombre completo es obligatorio.";
      if (valor.trim().length < 3) return "El nombre debe tener al menos 3 caracteres.";
    }
    if (name === "telefono") {
      if (!valor) return "El teléfono es obligatorio.";
      if (!/^\d{10}$/.test(valor)) return "El teléfono debe contener exactamente 10 números.";
      if (!valor.startsWith("09")) return "El teléfono ecuatoriano debe comenzar con 09.";
    }
    if (name === "correo") {
      if (!valor.trim()) return "El correo electrónico es obligatorio.";
      if (!valor.includes("@")) return "Falta el símbolo @ en el correo.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim())) {
        return "Escribe un correo completo, por ejemplo usuario@correo.com.";
      }
    }
    if (name === "password") {
      if (!valor) return "La contraseña es obligatoria.";
      const requisitos = [];
      if (valor.length < 8) requisitos.push("8 caracteres");
      if (!/[A-Z]/.test(valor)) requisitos.push("una mayúscula");
      if (!/[a-z]/.test(valor)) requisitos.push("una minúscula");
      if (!/\d/.test(valor)) requisitos.push("un número");
      if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]/.test(valor)) requisitos.push("un carácter especial");
      if (requisitos.length) return `Falta: ${requisitos.join(", ")}.`;
    }
    if (name === "confirmarPassword") {
      if (!valor) return "Debes confirmar la contraseña.";
      if (valor !== datos.password) return "Las contraseñas no coinciden.";
    }
    if (name === "planId" && !valor) return "Selecciona el servicio que deseas.";
    if (name === "direccion") {
      if (!valor.trim()) return "La dirección de instalación es obligatoria.";
      if (valor.trim().length < 8) return "Escribe una dirección más completa.";
    }
    if (name === "integrantesHogar" && Number(valor) < 1) {
      return "Debe existir al menos un integrante.";
    }
    if (name === "menoresTrece" && Number(valor) > Number(datos.integrantesHogar)) {
      return "Los menores no pueden superar el total de integrantes.";
    }
    if (name === "aceptaTerminos" && !valor) return "Debes aceptar los términos y la permanencia mínima de 4 meses.";
    return "";
  }

  useEffect(() => {
    async function cargarPlanes() {
      const { data, error } = await supabase
        .from("service_plans")
        .select("*")
        .order("id");

      if (error) {
        setMensajeGeneral(
          `No se pudieron cargar los servicios: ${error.message}`
        );
        return;
      }

      setPlanes(data ?? []);
    }

    cargarPlanes();
  }, []);

  function manejarCambio(evento) {
    const { name, value, type, checked } = evento.target;

    let nuevoValor = type === "checkbox" ? checked : value;

    if (name === "telefono") {
      nuevoValor = value.replace(/\D/g, "").slice(0, 10);
    }

    const siguienteFormulario = { ...formulario, [name]: nuevoValor };
    setFormulario(siguienteFormulario);

    setErrores((anteriores) => {
      const siguientes = {
        ...anteriores,
        [name]: validarCampo(name, siguienteFormulario),
      };
      if (name === "password" && siguienteFormulario.confirmarPassword) {
        siguientes.confirmarPassword = validarCampo("confirmarPassword", siguienteFormulario);
      }
      if (name === "integrantesHogar") {
        siguientes.menoresTrece = validarCampo("menoresTrece", siguienteFormulario);
      }
      return siguientes;
    });

    setMensajeGeneral("");
  }

  function validarFormulario() {
    const nuevosErrores = {};

    if (!formulario.nombre.trim()) {
      nuevosErrores.nombre = "El nombre completo es obligatorio.";
    } else if (formulario.nombre.trim().length < 3) {
      nuevosErrores.nombre = "El nombre debe tener al menos 3 caracteres.";
    }

    if (!formulario.telefono) {
      nuevosErrores.telefono = "El teléfono es obligatorio.";
    } else if (!/^\d{10}$/.test(formulario.telefono)) {
      nuevosErrores.telefono =
        "El teléfono debe contener exactamente 10 números.";
    } else if (!formulario.telefono.startsWith("09")) {
      nuevosErrores.telefono =
        "El teléfono ecuatoriano debe comenzar con 09.";
    }

    if (!formulario.correo.trim()) {
      nuevosErrores.correo = "El correo electrónico es obligatorio.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formulario.correo.trim())
    ) {
      nuevosErrores.correo =
        "Ingresa un correo válido, por ejemplo usuario@correo.com.";
    }

    if (!formulario.password) {
      nuevosErrores.password = "La contraseña es obligatoria.";
    } else {
      const erroresPassword = [];

      if (formulario.password.length < 8) {
        erroresPassword.push("mínimo 8 caracteres");
      }

      if (!/[A-Z]/.test(formulario.password)) {
        erroresPassword.push("una letra mayúscula");
      }

      if (!/[a-z]/.test(formulario.password)) {
        erroresPassword.push("una letra minúscula");
      }

      if (!/\d/.test(formulario.password)) {
        erroresPassword.push("un número");
      }

      if (
        !/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]/.test(
          formulario.password
        )
      ) {
        erroresPassword.push("un carácter especial");
      }

      if (erroresPassword.length > 0) {
        nuevosErrores.password = `La contraseña debe incluir: ${erroresPassword.join(
          ", "
        )}.`;
      }
    }

    if (!formulario.confirmarPassword) {
      nuevosErrores.confirmarPassword =
        "Debes confirmar la contraseña.";
    } else if (
      formulario.password !== formulario.confirmarPassword
    ) {
      nuevosErrores.confirmarPassword =
        "Las contraseñas no coinciden.";
    }

    if (!formulario.planId) {
      nuevosErrores.planId = "Selecciona el servicio que deseas.";
    }

    if (!formulario.tipoPropiedad) {
      nuevosErrores.tipoPropiedad =
        "Selecciona el tipo de propiedad.";
    }

    if (!formulario.direccion.trim()) {
      nuevosErrores.direccion =
        "La dirección de instalación es obligatoria.";
    } else if (formulario.direccion.trim().length < 8) {
      nuevosErrores.direccion =
        "Escribe una dirección más completa.";
    }

    if (Number(formulario.integrantesHogar) < 1) {
      nuevosErrores.integrantesHogar =
        "Debe existir al menos un integrante.";
    }

    if (
      Number(formulario.menoresTrece) >
      Number(formulario.integrantesHogar)
    ) {
      nuevosErrores.menoresTrece =
        "Los menores no pueden superar el total de integrantes.";
    }

    if (!formulario.aceptaTerminos) {
      nuevosErrores.aceptaTerminos = "Debes aceptar los términos y la permanencia mínima de 4 meses.";
    }

    setErrores(nuevosErrores);

    return Object.keys(nuevosErrores).length === 0;
  }

  async function registrarseConGoogle() {
    setMensajeGeneral("");
    setCargando(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMensajeGeneral(
        `No se pudo continuar con Google: ${error.message}`
      );
      setCargando(false);
    }
  }

  async function crearSolicitud(usuario) {
    const { error } = await supabase.from("service_requests").insert({
      client_id: usuario.id,
      plan_id: Number(formulario.planId),
      property_type: formulario.tipoPropiedad,
      installation_address: formulario.direccion.trim(),
      notes: [
        "DATOS DEL HOGAR",
        `Integrantes del hogar: ${formulario.integrantesHogar}`,
        `Menores de 13 años: ${formulario.menoresTrece}`,
        `Mascotas: ${formulario.cantidadMascotas}`,
        `Tamaño de mascotas: ${{ none: "No tiene", small: "Pequeño", medium: "Mediano", large: "Grande", mixed: "Varios tamaños" }[formulario.tamanoMascotas]}`,
        formulario.notas.trim() ? `Información adicional: ${formulario.notas.trim()}` : "",
      ].filter(Boolean).join("\n"),
    });
    if (error) throw new Error(`La cuenta se verificó, pero la solicitud no pudo guardarse: ${error.message}`);
  }

  async function registrarUsuario(evento) {
    evento.preventDefault();
    setMensajeGeneral("");

    const formularioValido = validarFormulario();

    if (!formularioValido) {
      setMensajeGeneral(
        "No se pudo completar el registro. Revisa los campos marcados."
      );
      return;
    }

    setCargando(true);

    const { data, error } = await supabase.auth.signUp({
      email: formulario.correo.trim().toLowerCase(),
      password: formulario.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: formulario.nombre.trim(),
          phone: formulario.telefono,
          terms_accepted_at: new Date().toISOString(),
          minimum_term_months: 4,
        },
      },
    });

    if (error) {
      console.error("Error de Supabase al registrar:", {
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.status,
      });
      const detalleError = typeof error.message === "string" && error.message !== "{}"
        ? error.message
        : error.code || (error.status ? `Error ${error.status} de Supabase` : "Supabase rechazó la creación de la cuenta");
      const mensajeError = detalleError.toLowerCase();

      if (mensajeError.includes("signup") && mensajeError.includes("disabled")) {
        setMensajeGeneral("El registro por correo está desactivado en Supabase. Activa Email y Allow new users to sign up.");
      } else if (mensajeError.includes("already registered")) {
        setErrores((anteriores) => ({
          ...anteriores,
          correo: "Este correo ya está registrado.",
        }));
      } else if (mensajeError.includes("password")) {
        setErrores((anteriores) => ({
          ...anteriores,
          password: detalleError,
        }));
      } else if (mensajeError.includes("email")) {
        setErrores((anteriores) => ({
          ...anteriores,
          correo: detalleError,
        }));
      } else {
        setMensajeGeneral(`Error al crear la cuenta: ${detalleError}${error.status ? ` (estado ${error.status})` : ""}`);
      }

      setCargando(false);
      return;
    }

    const usuario = data.user;

    if (!usuario) {
      setMensajeGeneral("No se pudo crear el usuario.");
      setCargando(false);
      return;
    }

    if (!data.session) {
      setMensajeGeneral("Cuenta creada. Revisa tu correo y abre el enlace de confirmación; después podrás iniciar sesión.");
      setCargando(false);
      return;
    }

    try {
      await crearSolicitud(usuario);
      navigate("/disena-tu-sistema", { replace: true });
    } catch (solicitudError) {
      setMensajeGeneral(solicitudError.message);
      setCargando(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/" aria-label="Volver al inicio">
          <span className="brand-mark">S</span><span>SecureHome</span>
        </Link>
        <h1>Crear cuenta</h1>

        <p>Solicita tu sistema de seguridad SecureHome IoT.</p>

        <button
          type="button"
          className="google-button"
          onClick={registrarseConGoogle}
          disabled={cargando}
        >
          {cargando ? "Abriendo Google..." : "Continuar con Google"}
        </button>

        <div className="auth-divider">
          <span>o regístrate con correo</span>
        </div>

        <form
          onSubmit={registrarUsuario}
          className="auth-form"
          noValidate
        >
          <label>
            Nombre completo
            <input
              name="nombre"
              value={formulario.nombre}
              onChange={manejarCambio}
              placeholder="Nombre completo"
              className={errores.nombre ? "input-error" : ""}
              aria-invalid={Boolean(errores.nombre)}
            />

            {errores.nombre && (
              <span className="field-error">
                {errores.nombre}
              </span>
            )}
          </label>

          <label>
            Teléfono
            <input
              name="telefono"
              value={formulario.telefono}
              onChange={manejarCambio}
              placeholder="Teléfono"
              inputMode="numeric"
              maxLength={10}
              className={errores.telefono ? "input-error" : ""}
              aria-invalid={Boolean(errores.telefono)}
            />

            {errores.telefono && (
              <span className="field-error">
                {errores.telefono}
              </span>
            )}
          </label>

          <label>
            Correo
            <input
              type="email"
              name="correo"
              value={formulario.correo}
              onChange={manejarCambio}
              placeholder="Correo electrónico"
              className={errores.correo ? "input-error" : ""}
              aria-invalid={Boolean(errores.correo)}
            />

            {errores.correo && (
              <span className="field-error">
                {errores.correo}
              </span>
            )}
          </label>

          <label>
            Contraseña
            <input
              type="password"
              name="password"
              value={formulario.password}
              onChange={manejarCambio}
              placeholder="Mínimo 8 caracteres"
              className={errores.password ? "input-error" : ""}
              aria-invalid={Boolean(errores.password)}
            />

            <small className="password-help">
              Debe tener 8 caracteres, mayúscula, minúscula,
              número y carácter especial.
            </small>

            {errores.password && (
              <span className="field-error">
                {errores.password}
              </span>
            )}
          </label>

          <label>
            Confirmar contraseña
            <input
              type="password"
              name="confirmarPassword"
              value={formulario.confirmarPassword}
              onChange={manejarCambio}
              placeholder="Confirmar contraseña"
              className={
                errores.confirmarPassword ? "input-error" : ""
              }
              aria-invalid={Boolean(errores.confirmarPassword)}
            />

            {errores.confirmarPassword && (
              <span className="field-error">
                {errores.confirmarPassword}
              </span>
            )}
          </label>

          <label>
            Servicio deseado
            <select
              name="planId"
              value={formulario.planId}
              onChange={manejarCambio}
              className={errores.planId ? "input-error" : ""}
              aria-invalid={Boolean(errores.planId)}
            >
              <option value="">Selecciona un servicio</option>

              {planes.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>

            {errores.planId && (
              <span className="field-error">
                {errores.planId}
              </span>
            )}
          </label>

          <label>
            Tipo de propiedad
            <select
              name="tipoPropiedad"
              value={formulario.tipoPropiedad}
              onChange={manejarCambio}
            >
              <option value="house">Casa</option>
              <option value="apartment">Departamento</option>
              <option value="business">Negocio</option>
              <option value="office">Oficina</option>
            </select>
          </label>

          <label>
            Dirección de instalación
            <input
              name="direccion"
              value={formulario.direccion}
              onChange={manejarCambio}
              placeholder="Ciudad, sector y referencia"
              className={errores.direccion ? "input-error" : ""}
              aria-invalid={Boolean(errores.direccion)}
            />

            {errores.direccion && (
              <span className="field-error">
                {errores.direccion}
              </span>
            )}
          </label>

          <fieldset className="household-fields">
            <legend>Personas y mascotas en el hogar</legend>
            <div>
              <label>
                Integrantes del hogar
                <input type="number" name="integrantesHogar" min="1" max="30" value={formulario.integrantesHogar} onChange={manejarCambio} className={errores.integrantesHogar ? "input-error" : ""} />
                {errores.integrantesHogar && <span className="field-error">{errores.integrantesHogar}</span>}
              </label>
              <label>
                Menores de 13 años
                <input type="number" name="menoresTrece" min="0" max="30" value={formulario.menoresTrece} onChange={manejarCambio} className={errores.menoresTrece ? "input-error" : ""} />
                {errores.menoresTrece && <span className="field-error">{errores.menoresTrece}</span>}
              </label>
              <label>
                Cantidad de mascotas
                <input type="number" name="cantidadMascotas" min="0" max="20" value={formulario.cantidadMascotas} onChange={manejarCambio} />
              </label>
              <label>
                Tamaño de las mascotas
                <select name="tamanoMascotas" value={formulario.tamanoMascotas} onChange={manejarCambio}>
                  <option value="none">No tiene mascotas</option>
                  <option value="small">Pequeño</option>
                  <option value="medium">Mediano</option>
                  <option value="large">Grande</option>
                  <option value="mixed">Varios tamaños</option>
                </select>
              </label>
            </div>
            <small>Esto ayuda a calibrar los sensores y reducir falsas alarmas.</small>
          </fieldset>

          <label>
            Información adicional
            <textarea
              name="notas"
              value={formulario.notas}
              onChange={manejarCambio}
              placeholder="Detalles de la instalación"
            />
          </label>

          <label className="terms-acceptance">
            <input type="checkbox" name="aceptaTerminos" checked={formulario.aceptaTerminos} onChange={manejarCambio}/>
            <span>Acepto los <Link to="/terminos" target="_blank">términos y condiciones</Link> y la permanencia mínima obligatoria de 4 meses.</span>
            {errores.aceptaTerminos && <span className="field-error">{errores.aceptaTerminos}</span>}
          </label>

          {mensajeGeneral && (
            <p className="auth-message">{mensajeGeneral}</p>
          )}

          <button type="submit" disabled={cargando}>
            {cargando ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p>
          ¿Ya tienes una cuenta?{" "}
          <Link to="/login">Inicia sesión</Link>
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;
