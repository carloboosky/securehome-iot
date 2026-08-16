# TA-3.5 — Estrategia de despliegue y rollback

**Estudiante:** Carrion Calo  
**Actividad:** Trabajo autónomo TA-3.5 — Estrategia de despliegue y rollback  
**Proyecto:** SecureHome IoT

## 1. Síntesis del caso

Este análisis profundiza el flujo implementado en la práctica
[PE-3.5](./PE-3.5_CarrionCalo_CI-CD.md). SecureHome IoT es una aplicación web con
React y Vite que utiliza Supabase para autenticación, datos y tiempo real. También
incluye funciones de servidor en Vercel para exponer un MCP protegido mediante
OAuth. Por ello, una liberación puede afectar tanto la interfaz como la autorización
y el acceso a información del sistema de seguridad.

El workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) se activa en
pull requests y en pushes a `main` o `master`. Su job `quality` ejecuta:

```text
npm ci → ESLint → pruebas → build Vite → paquete .tar.gz → artefacto de Actions
```

`npm ci` reproduce el lockfile; ESLint detecta problemas estáticos; las pruebas
validan OAuth/PKCE y trazabilidad; el build confirma que la aplicación puede
compilarse; y el artefacto conserva `dist` y `vercel.json` asociado al SHA durante
14 días. Vercel, mediante su integración con GitHub, genera un Preview para la rama
y un deployment de producción al actualizar `main`.

El riesgo que se busca reducir es publicar un commit que no compile, que incumpla
reglas de calidad o que rompa funciones sensibles. El flujo también reduce la
ambigüedad operativa porque cada ejecución, artefacto y deployment puede
relacionarse con un SHA. No elimina por sí solo fallos de configuración, errores de
datos o regresiones no cubiertas por pruebas; estos requieren controles de
liberación y rollback.

## 2. Estrategia de despliegue seleccionada

### Alternativas evaluadas

| Estrategia | Ventaja | Limitación para este caso |
| --- | --- | --- |
| Blue-Green | Cambio rápido entre dos ambientes productivos equivalentes | Exige duplicar y sincronizar infraestructura, configuración y datos |
| Canary | Limita el impacto al enviar solo un porcentaje de tráfico a la versión nueva | Requiere enrutamiento porcentual, métricas y criterios automáticos de promoción |
| Liberación controlada con Preview | Usa las capacidades actuales de GitHub y Vercel, permite validar antes de producción y conserva versiones inmutables | La comprobación previa es manual y no distribuye tráfico gradualmente |

La opción más adecuada para el alcance actual es una **liberación controlada con
Preview de Vercel**. SecureHome IoT es un MVP académico con una única aplicación y
un volumen que no justifica todavía la complejidad de Canary o un Blue-Green
completo. Vercel ya crea deployments aislados e inmutables por commit, de modo que
se obtiene buena parte del beneficio de separar la versión candidata de la estable
sin mantener dos plataformas manualmente.

El proceso propuesto es:

1. Crear una rama con un cambio acotado y abrir un pull request.
2. Exigir que el job `quality` termine correctamente.
3. Probar el Preview de Vercel con datos ficticios: carga de `/`, autenticación,
   separación de roles, una consulta principal y `/api/mcp-demo`.
4. Revisar cambios de configuración y migraciones de base de datos por separado.
5. Aprobar y fusionar en `main`; la integración de Vercel crea el deployment de
   producción a partir del commit ya validado.
6. Ejecutar un smoke test en producción y registrar el resultado.

Para que la estrategia sea efectiva, `main` debe estar protegida: sin pushes
directos, con pull request obligatorio y `quality` como *required status check*.
Así se evita que Vercel publique un commit que no haya pasado por la puerta de
calidad. Las migraciones SQL no deben ejecutarse automáticamente junto con el
frontend; primero se prueban en staging, se respalda la información y se confirma
que sean compatibles con la versión anterior durante la ventana de liberación.

## 3. Secretos y configuración

La configuración se separa por sensibilidad y por ambiente:

| Configuración | Tratamiento |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Son públicas en el bundle; se limitan mediante RLS y se separan entre Preview y Production |
| `MCP_SUPABASE_URL`, `MCP_PUBLIC_URL` | Configuración del servidor, almacenada por ambiente en Vercel |
| `MCP_SUPABASE_SERVICE_ROLE_KEY`, `MCP_OAUTH_SECRET` | Secretos críticos, disponibles solo para funciones de servidor |
| `.env` y `.env.mcp` | Archivos locales ignorados por Git; nunca se adjuntan como evidencia |
| `.env.example` y `.env.mcp.example` | Plantillas sin valores reales que documentan las variables necesarias |

Los controles aplicados o requeridos son:

1. mantener los secretos fuera del código, commits, artefactos, logs y capturas;
2. no asignar prefijo `VITE_` a información secreta, porque Vite la incorpora al
   JavaScript que recibe el navegador;
3. usar valores diferentes para Development, Preview y Production, con el mínimo
   privilegio posible;
4. permitir que CI ejecute lint, pruebas y build sin secretos productivos; las
   pruebas emplean valores controlados y no necesitan acceso a información real;
5. restringir en Vercel quién puede leer o modificar variables de producción y
   registrar todo cambio de configuración junto con el deployment relacionado;
6. rotar periódicamente los secretos y hacerlo inmediatamente ante una exposición.

La rotación se realiza creando una credencial nueva, actualizando Vercel,
desplegando y verificando la aplicación, y finalmente revocando la anterior cuando
el servicio admita coexistencia. Si una credencial ya fue expuesta, se revoca
primero para contener el incidente. Eliminarla de un commit no es suficiente porque
puede permanecer en el historial o haber sido copiada.

También debe validarse que `MCP_PUBLIC_URL` corresponda al ambiente. Una clave
correcta con una URL equivocada puede romper OAuth aunque el build sea exitoso;
por eso la configuración forma parte del smoke test y no solamente del pipeline.

## 4. Rollback y auditoría

### Criterio de activación

Se inicia rollback cuando el smoke test falla, aumenta la tasa de errores, no se
puede autenticar, se rompe el aislamiento entre roles o una función crítica deja de
responder. Ante una posible exposición de datos o secretos, primero se contiene el
acceso; restaurar código no sustituye revocar credenciales.

### Reversión de la aplicación

1. Suspender nuevas fusiones y abrir un registro de incidente.
2. Identificar el deployment sano anterior y su SHA.
3. En Vercel, usar **Promote to Production** sobre ese deployment inmutable.
4. Repetir el smoke test y confirmar la recuperación.
5. Crear una rama con `git revert <SHA_PROBLEMATICO>`; no usar `reset --hard` ni
   reescribir la rama compartida.
6. Abrir un pull request, ejecutar CI y fusionar el revert.
7. Cerrar el incidente solo después de alinear `main` con la versión operativa y
   documentar la causa y las acciones posteriores.

Promover primero el deployment sano reduce el tiempo de recuperación. El revert
posterior evita que el siguiente despliegue vuelva a introducir el commit fallido y
mantiene un historial auditable.

### Base de datos y configuración

El rollback de aplicación no revierte Supabase. Para cambios de esquema se requiere
un respaldo previo y un script compensatorio revisado. Conviene usar migraciones
compatibles hacia adelante: añadir campos antes de consumirlos y retirar los
antiguos solo después de que ninguna versión los use. Si el fallo proviene de una
variable, se restaura el valor anterior desde la gestión segura de configuración,
se vuelve a desplegar y se valida; los valores secretos nunca se copian al informe.

### Evidencia mínima

| Evidencia | Finalidad |
| --- | --- |
| ID del incidente, fecha y responsable | Establecer propiedad y cronología |
| SHA y pull request | Identificar exactamente el cambio |
| URL del run de Actions y resultado de cada paso | Demostrar las validaciones ejecutadas |
| Nombre/hash del artefacto | Relacionar el binario con el código |
| ID y ambiente del deployment de Vercel | Identificar qué versión fue expuesta |
| Smoke test antes y después del rollback | Demostrar fallo y recuperación |
| Síntoma, impacto y correlation ID | Facilitar diagnóstico sin registrar datos personales |
| Deployment restaurado y commit de revert | Probar la reversión técnica y lógica |
| Causa raíz y acción preventiva | Evitar la repetición del incidente |

Una entrada de auditoría mínima puede usar esta plantilla:

```text
Incidente / fecha / responsable:
SHA y pull request:
Run de CI / artefacto:
Deployment afectado / ambiente:
Síntoma e impacto:
Correlation ID (si aplica):
Deployment restaurado:
Commit de revert:
Smoke test posterior: APROBADO | FALLIDO
Causa y acción preventiva:
```

No se deben incluir tokens, contraseñas, correos, direcciones, teléfonos ni URL
privadas de cámaras en la evidencia.

## 5. Conclusión técnica

El control más importante para reducir el riesgo es convertir el pipeline en una
**puerta obligatoria antes de producción**. Tener pruebas no protege el sistema si
se permite fusionar o publicar ignorando su resultado. La combinación de rama
protegida, pull request, check `quality` obligatorio y validación del Preview hace
que cada versión productiva tenga evidencia previa y un SHA identificable.

La primera mejora que aplicaría es proteger `main` y exigir `quality` antes de cada
fusión. Inmediatamente después añadiría un smoke test automático contra el Preview
para validar carga, endpoint de demostración y configuración OAuth sin utilizar
datos reales. Esa automatización cerraría la principal brecha actual: el build
demuestra que el código compila, pero todavía no demuestra por sí solo que la
configuración desplegada funciona.

Canary sería una evolución razonable cuando existan mayor tráfico, métricas de error
y latencia confiables, alertas y capacidad de enrutar porcentajes de usuarios. En el
estado actual, una liberación controlada ofrece una reducción de riesgo proporcional
a la complejidad del proyecto y un rollback rápido mediante deployments inmutables.

## 6. Evidencia relacionada

- Pipeline: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
- Práctica base: [PE-3.5 CI/CD y despliegue básico](./PE-3.5_CarrionCalo_CI-CD.md).
- Procedimiento operativo: [operación, despliegue y rollback](./OPERACION.md).
- Evidencia funcional: [registro de evidencias](./EVIDENCIAS.md).
- Aplicación desplegada: <https://securehome-iot.vercel.app>.
