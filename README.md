# SecureHome IoT

Mínimo Producto Viable de una plataforma web para administrar instalaciones y monitorear sistemas de seguridad IoT.

## Enlaces

- Aplicación: https://securehome-iot.vercel.app
- Repositorio: https://github.com/carloboosky/securehome-iot
- Documento técnico de la fase III: [ENTREGA_FASE_III.md](./ENTREGA_FASE_III.md)
- Evidencia reproducible: [docs/EVIDENCIAS.md](./docs/EVIDENCIAS.md)
- Práctica PE-3.4 de trazabilidad: [docs/PE-3.4-TRAZABILIDAD.md](./docs/PE-3.4-TRAZABILIDAD.md)

## Funcionalidades

- Registro, inicio de sesión, Google OAuth y recuperación de contraseña.
- Roles de cliente y administrador con rutas protegidas.
- Solicitudes de instalación y seguimiento de estados.
- Agenda con feriados, turnos ocupados y anticipación mínima de dos horas.
- Chat en tiempo real con imágenes y notificaciones.
- Mensajes automáticos por cambios de solicitud y cita.
- Dirección de cámara exclusiva para cada cliente.
- Acceso administrativo temporal mediante código.
- Stream MJPEG, reconexión y pantalla completa.
- Detección local de personas con MediaPipe y EfficientDet-Lite2.
- Alertas hacia el backend AWS con cooldown.
- Gestión administrativa de clientes, cámaras y solicitudes.

## Tecnologías

- React 19
- Vite 8
- React Router
- Supabase Auth, PostgreSQL, Realtime y Storage
- MediaPipe Tasks Vision
- Vercel
- Backend AWS para streaming y alertas

## Ejecución local

```bash
git clone https://github.com/carloboosky/securehome-iot.git
cd securehome-iot
npm install
npm run dev
```

Crea un archivo `.env` local con la configuración pública de Supabase. El archivo está excluido del repositorio.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

La integración continua ejecuta `npm ci`, lint y build en cada push y pull request.
Consulta el procedimiento de despliegue y rollback en el
[documento de operación](./docs/OPERACION.md).

## Servidor MCP

El proyecto incluye un servidor MCP oficial de solo lectura en `mcp/server.js`. Expone las herramientas `list-clients`, `get-security-overview`, `list-cameras` y `get-household` para que un cliente de IA consulte el sistema sin poder desbloquear puertas, desactivar alarmas ni modificar datos.

Antes de probar las herramientas, ejecuta `supabase_mcp_readonly_setup.sql` en Supabase SQL Editor. La migración concede al rol `service_role` solamente acceso `SELECT` sobre las tablas consultadas.

Primero copia `.env.mcp.example` como `.env.mcp`, completa sus dos variables y ejecuta:

```bash
npm run mcp
```

Puedes adaptar `mcp/mcp-config.example.json` para registrar el servidor en un host compatible. La clave `MCP_SUPABASE_SERVICE_ROLE_KEY` es secreta: nunca debe incluirse en Git, Vercel ni en el frontend.

## Base de datos

Los archivos `supabase_*.sql` contienen las tablas, políticas RLS, funciones administrativas y triggers requeridos. Deben ejecutarse desde Supabase SQL Editor según el módulo que se vaya habilitando.

## Código de verificación de registro

El registro por correo valida al usuario mediante el OTP de seis dígitos de Supabase. En **Authentication → Email Templates → Confirm signup**, la plantilla debe mostrar el token, por ejemplo:

```html
<h2>Confirma tu cuenta de SecureHome</h2>
<p>Tu código de verificación es:</p>
<h1>{{ .Token }}</h1>
```

También debe permanecer habilitada la confirmación de correo en **Authentication → Providers → Email**. El formulario crea la solicitud de instalación únicamente después de que el código sea validado.

## Estado

Los flujos web principales del MVP están implementados. La conexión definitiva de sirena, sensores NFC y demás hardware físico permanece como trabajo posterior.
