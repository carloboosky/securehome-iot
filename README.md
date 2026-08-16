# SecureHome IoT

Mínimo Producto Viable de una plataforma web para administrar instalaciones y monitorear sistemas de seguridad IoT.

## Enlaces

- Aplicación: https://securehome-iot.vercel.app
- Repositorio: https://github.com/carloboosky/securehome-iot
- Documento técnico de la fase III: [FASE-III_CarrionCalo_ProyectoFinal.md](./FASE-III_CarrionCalo_ProyectoFinal.md)
- Evidencia reproducible: [docs/EVIDENCIAS.md](./docs/EVIDENCIAS.md)
- Práctica PE-3.4 de trazabilidad: [docs/PE-3.4_CarrionCalo_Trazabilidad.md](./docs/PE-3.4_CarrionCalo_Trazabilidad.md)
- Trabajo autónomo TA-3.4: [análisis de observabilidad y latencias](./docs/TA-3.4_CarrionCalo_Observabilidad.md)
- Práctica CI/CD: [flujo, secretos, despliegue y rollback](./docs/CI-CD.md)

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

Copia `.env.example` como `.env` y completa la configuración pública de Supabase.
El archivo real está excluido del repositorio.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

La integración continua ejecuta instalación reproducible, lint, pruebas y build en
cada push y pull request, y conserva un artefacto identificado por el SHA.
Consulta el procedimiento de despliegue y rollback en el
[documento de la práctica CI/CD](./docs/CI-CD.md) y el detalle de
[operación](./docs/OPERACION.md).

## Servidor MCP

El proyecto incluye un servidor MCP oficial de solo lectura en `mcp/server.js`. Expone las herramientas `list-clients`, `get-security-overview`, `list-cameras` y `get-household` para que un cliente de IA consulte el sistema sin poder desbloquear puertas, desactivar alarmas ni modificar datos.

Antes de probar las herramientas, ejecuta `supabase_mcp_readonly_setup.sql` en Supabase SQL Editor. El servidor expone únicamente herramientas de consulta, pero `service_role` continúa siendo una credencial privilegiada de Supabase: debe tratarse como un secreto crítico y utilizarse solamente en un entorno local controlado.

Primero copia `.env.mcp.example` como `.env.mcp`, completa sus dos variables y ejecuta:

```bash
cp .env.mcp.example .env.mcp
nano .env.mcp
npm run mcp
```

`npm run mcp` inicia un servidor por entrada/salida estándar: no abre una página ni un puerto. Al ejecutarlo manualmente quedará esperando a que un cliente MCP envíe el protocolo. Para usar sus herramientas, copia `mcp/mcp-config.example.json` en la configuración del cliente compatible y reemplaza `cwd` por la ruta absoluta del repositorio.

La clave se lee desde `.env.mcp`; no debe repetirse dentro del JSON de configuración. `MCP_SUPABASE_SERVICE_ROLE_KEY` es secreta: nunca debe incluirse en Git, Vercel, capturas ni en el frontend.

Comprobaciones útiles:

```bash
npm install
npm run lint
npm test
npm run mcp
```

Si aparece `Configura MCP_SUPABASE_URL...`, revisa `.env.mcp`. Si el proceso queda abierto mostrando `esperando un cliente mediante stdio`, el arranque es correcto; se detiene con `Ctrl+C`.

### MCP remoto

La función de Vercel `api/mcp.js` publica las mismas herramientas mediante Streamable HTTP en:

```text
https://securehome-iot.vercel.app/api/mcp
```

El MCP remoto utiliza OAuth 2.1 con PKCE. La persona pega únicamente la URL en un cliente MCP compatible, inicia sesión en SecureHome y autoriza el acceso desde el navegador. Solo las cuentas cuyo perfil tenga el rol `admin` pueden completar la autorización.

En Vercel deben existir los secretos `MCP_SUPABASE_URL`, `MCP_SUPABASE_SERVICE_ROLE_KEY` y `MCP_OAUTH_SECRET`, además de `MCP_PUBLIC_URL=https://securehome-iot.vercel.app`. Genera `MCP_OAUTH_SECRET` como un valor aleatorio de al menos 32 caracteres. No lo incluyas en el repositorio ni en el frontend.

Después del despliegue, el cliente únicamente necesita esta URL:

```text
https://securehome-iot.vercel.app/api/mcp
```

### MCP público de demostración

Para la exposición académica existe un endpoint separado que no solicita login y
solo devuelve datos ficticios. No consulta Supabase ni expone información real:

```text
https://securehome-iot.vercel.app/api/mcp-demo
```

El MCP productivo `/api/mcp` conserva OAuth y debe utilizarse para datos reales.
El mismo endpoint demo acepta `GET` para que un navegador o un asistente con
navegación pueda revisar la descripción, las herramientas y los usuarios ficticios;
los clientes MCP continúan usando `POST`.

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
