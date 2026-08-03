# SecureHome IoT

Mínimo Producto Viable de una plataforma web para administrar instalaciones y monitorear sistemas de seguridad IoT.

## Enlaces

- Aplicación: https://securehome-iot.vercel.app
- Repositorio: https://github.com/carloboosky/securehome-iot
- Informe del MVP: [ENTREGA_MVP.md](./ENTREGA_MVP.md)

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

## Base de datos

Los archivos `supabase_*.sql` contienen las tablas, políticas RLS, funciones administrativas y triggers requeridos. Deben ejecutarse desde Supabase SQL Editor según el módulo que se vaya habilitando.

## Estado

Los flujos web principales del MVP están implementados. La conexión definitiva de sirena, sensores NFC y demás hardware físico permanece como trabajo posterior.
