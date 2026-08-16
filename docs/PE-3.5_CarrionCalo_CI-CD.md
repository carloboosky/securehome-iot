# PE-3.5 CI/CD y despliegue básico

## Flujo aplicado

SecureHome IoT usa GitHub Actions como puerta de calidad y Vercel como plataforma
de publicación. En cada *push* a `main`/`master` y en cada *pull request*, el job
`quality` realiza esta secuencia:

```text
checkout → Node.js 22 → npm ci → lint → tests → build → artefacto .tar.gz
```

`npm ci` reproduce exactamente `package-lock.json`; ESLint valida el código; las
pruebas de Node comprueban OAuth y observabilidad; Vite genera `dist`; finalmente,
Actions empaqueta `dist` y `vercel.json` con el SHA del commit y conserva el
artefacto durante 14 días. Si un paso falla, los posteriores no se ejecutan y el
commit no debe liberarse.

Archivo técnico: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Gestión de secretos

| Variable | Clasificación | Ubicación permitida |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Pública | `.env` local o variables de Vercel |
| `VITE_SUPABASE_ANON_KEY` | Pública, limitada por RLS | `.env` local o variables de Vercel |
| `MCP_SUPABASE_URL` | Configuración del servidor | variables cifradas de Vercel / `.env.mcp` local |
| `MCP_SUPABASE_SERVICE_ROLE_KEY` | Secreto crítico | solo variables cifradas del servidor |
| `MCP_OAUTH_SECRET` | Secreto crítico | solo variables cifradas del servidor |
| `MCP_PUBLIC_URL` | Configuración pública | variables de Vercel por ambiente |

Reglas del proyecto:

1. Partir de `.env.example` o `.env.mcp.example`, pero nunca versionar los archivos
   reales `.env*`; `.gitignore` los excluye.
2. No usar prefijo `VITE_` para secretos: Vite incorpora esas variables al bundle
   que descarga el navegador.
3. Guardar secretos de ejecución en Vercel, con valores distintos para Preview y
   Production. El pipeline de CI no los necesita y por eso no recibe secretos.
4. No imprimir valores sensibles en logs, capturas, artefactos o comentarios del PR.
5. Ante una filtración, revocar/rotar primero la credencial, actualizar el entorno y
   volver a desplegar. Borrar el texto de Git no sustituye la rotación.

## Liberación controlada

1. Trabajar en una rama y abrir un pull request con un cambio acotado.
2. Esperar el check `quality` y revisar su artefacto asociado al SHA.
3. Usar el deployment Preview de Vercel como *staging* y ejecutar el *smoke test*:
   carga de `/`, autenticación de cliente y administrador, consulta aislada de una
   solicitud y prueba del chat/stream con datos ficticios.
4. Aprobar y fusionar solamente si CI y *smoke test* pasan. La fusión crea el
   deployment de producción; la exposición ocurre después de validar Preview.
5. Verificar en producción `/` y `/api/mcp-demo`. Las migraciones SQL se prueban y
   respaldan por separado antes de aplicarlas; no se ejecutan automáticamente.

En GitHub se debe configurar `quality` como *required status check* y proteger la
rama principal. En Vercel, Preview y Production deben usar ambientes y variables
separados.

## Auditoría y rollback

Por cada liberación se conserva: PR y aprobaciones, SHA, ejecución de Actions,
artefacto con el SHA, deployment de Vercel, fecha/responsable y resultado del
*smoke test*. No se adjuntan tokens ni datos personales. La plantilla mínima para
el PR o registro de despliegue es:

```text
Versión/SHA:
URL del run de CI:
URL/ID del deployment:
Responsable y fecha:
Smoke test: APROBADO | FALLIDO
Incidencias/observaciones:
```

Si aparece una regresión:

1. detener nuevas fusiones y registrar el incidente;
2. en Vercel, promover a Production el último deployment sano e inmutable;
3. ejecutar otra vez el *smoke test* y registrar el deployment restaurado;
4. crear `git revert <sha>` en una rama y fusionarlo mediante un PR con CI verde;
5. para base de datos, usar el script compensatorio revisado o restaurar el respaldo;
   nunca revertir DDL destructivo a ciegas.

Esta combinación recupera primero el servicio y después alinea la rama principal
con la versión operativa, sin reescribir el historial compartido.

## Evidencia reproducible

Localmente:

```bash
cp .env.example .env
npm ci
npm test
npm run lint
npm run build
```

En GitHub, la pestaña **Actions** debe mostrar el job `quality` verde y, dentro del
run, el artefacto `securehome-iot-<SHA>`. En Vercel, **Deployments** registra el SHA,
estado, ambiente, fecha y autor de cada publicación.
