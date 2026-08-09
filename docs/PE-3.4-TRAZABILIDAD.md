# PE-3.4 — Trazabilidad y monitoreo

## 1. Flujo instrumentado

Se instrumentó el flujo real de consulta **Resumen de seguridad**:

```text
Cliente MCP
  → herramienta get-security-overview
    → Supabase/PostgREST
      → PostgreSQL: solicitud, cámaras, residentes, mascotas y diseño
    ← consolidación del estado del hogar
  ← respuesta con correlationId
```

El flujo atraviesa el servidor MCP y la capa de datos. Las cinco consultas se ejecutan
en paralelo y cada una tiene una marca independiente. La implementación está en
`mcp/server.js` y el componente reutilizable en `mcp/observability.js`.

## 2. Mecanismo de correlación

La entrada `correlationId` acepta un UUID proporcionado por el cliente. Si se omite,
el servidor genera uno mediante `crypto.randomUUID()`. El mismo valor aparece en:

1. `trace.started` al recibir la solicitud;
2. `span.started` y `span.finished` en cada acceso a PostgreSQL;
3. `trace.finished` al completar o fallar el flujo;
4. la respuesta MCP devuelta al cliente.

Esto permite filtrar todos los eventos de una solicitud sin almacenar nombres,
direcciones, teléfonos, URLs de cámara ni contenido de las tablas.

Ejemplo de entrada:

```json
{
  "requestId": "UUID_DE_UNA_SOLICITUD_REAL",
  "correlationId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
}
```

## 3. Logs estructurados y señales

Cada línea enviada a `stderr` es JSON válido y contiene:

| Campo | Uso diagnóstico |
|---|---|
| `timestamp` | orden temporal |
| `service` | componente emisor |
| `correlation_id` | unión de eventos del mismo recorrido |
| `operation` y `span` | paso exacto |
| `duration_ms` | latencia del paso o total |
| `outcome` | `success` o `error` |
| `error_code` | clasificación del fallo sin exponer datos sensibles |

La salida MCP permanece en `stdout` y los logs se escriben en `stderr`, evitando
romper el protocolo. La evidencia automatizada se verifica con:

```bash
npm test
npm run observability:demo
```

## 4. Caso normal frente a caso degradado

| Señal | Caso normal | Caso degradado/fallido |
|---|---|---|
| Correlación de demostración | `aaaaaaaa-...` | `bbbbbbbb-...` |
| Span observado | `database.service_requests.select` | `database.camera_devices.select` |
| Latencia simulada reproducible | aproximadamente 20 ms | aproximadamente 200 ms |
| Resultado | `success` | `error` |
| Código | ninguno | `PGRST301` |

El script de demostración utiliza la misma implementación que el flujo real y sólo
controla el tiempo/respuesta del adaptador para reproducir ambos escenarios sin
alterar producción. Para evidencia real, se invoca la herramienta MCP con una
solicitud válida y luego con credenciales inválidas o una indisponibilidad controlada
en staging; nunca se degrada el ambiente productivo.

## 5. Diagnóstico

En el caso degradado, `database.camera_devices.select` tarda cerca de 200 ms y termina
con `PGRST301`. Los eventos anteriores comparten correlation ID y el span identifica
la consulta exacta, por lo que el origen está en el acceso de PostgREST/Supabase a
`camera_devices`, no en la recepción de la herramienta ni en la consolidación MCP.
El `trace.finished` fallido confirma que ese error provoca el fallo global.

En un incidente real, se compararía la duración de los cinco spans: si sólo uno crece,
se revisan su consulta, índices y políticas RLS; si todos crecen de forma semejante,
se investiga conectividad o saturación de Supabase.

## 6. Evidencia para entregar

- Código: `mcp/observability.js` y `mcp/server.js`.
- Pruebas: `test/observability.test.js`.
- Salida comparativa: `docs/evidencias/trazabilidad-normal-vs-fallo.txt`.
- Captura recomendada: terminal ejecutando `npm run observability:demo`, guardada como
  `docs/evidencias/05-trazabilidad-normal-vs-fallo.png`.

Los avances deben publicarse en commits separados, por ejemplo:

1. `feat: agregar correlation ID al resumen de seguridad`
2. `feat: registrar spans y latencia de consultas Supabase`
3. `test: comparar trazas normales y fallidas`
4. `docs: documentar diagnóstico de observabilidad PE-3.4`
