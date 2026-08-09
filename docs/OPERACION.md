# Operación, despliegue y rollback

## Configuración

El frontend requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Ambas son
configuración pública; la autorización continúa en RLS. El MCP requiere
`MCP_SUPABASE_URL` y `MCP_SUPABASE_SERVICE_ROLE_KEY`; esta última es secreta y sólo
debe existir en el entorno del proceso MCP.

Las migraciones `supabase_*.sql` se aplican de forma controlada en Supabase SQL
Editor. Antes de producción se recomienda probarlas en un proyecto de staging y
guardar un respaldo lógico.

## Despliegue

1. Crear una rama y un commit con alcance técnico único.
2. Abrir un pull request y exigir el job `quality` exitoso.
3. Configurar las variables del frontend en Vercel, separadas por ambiente.
4. Fusionar a la rama principal; Vercel genera un deployment inmutable.
5. Ejecutar smoke tests: abrir `/`, iniciar sesión con ambos roles, consultar una
   solicitud y comprobar el stream/chat sin exponer datos de otro cliente.

## Monitoreo

- GitHub Actions: lint y compilación reproducible.
- Vercel: estado de despliegue y Analytics.
- Supabase: Auth, Database, Realtime y logs de API.
- MCP: errores y ciclo de vida por `stderr`.
- AWS: disponibilidad del stream y recepción de alertas (pendiente centralizar).

Nunca deben copiarse tokens, correos, teléfonos ni URLs privadas de cámaras en una
captura pública. Para evidencias académicas se usan datos ficticios o anonimizados.

## Rollback

Ante una regresión del frontend, usar **Promote to Production** sobre el último
deployment sano de Vercel y registrar el incidente. Después, revertir el commit con
`git revert <sha>` mediante pull request; no reescribir la rama compartida.

Una migración de datos requiere un script compensatorio revisado y respaldo previo.
No se recomienda revertir DDL destructivo automáticamente. Si se compromete una
credencial, revocarla primero, rotarla y desplegar la nueva configuración.
