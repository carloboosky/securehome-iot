import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

function writeLog(entry) {
  process.stderr.write(`${JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "securehome-mcp",
    ...entry,
  })}\n`);
}

export function createTrace(operation, requestedCorrelationId) {
  const correlationId = requestedCorrelationId || randomUUID();
  const traceStartedAt = performance.now();

  writeLog({
    level: "info",
    event: "trace.started",
    correlation_id: correlationId,
    operation,
  });

  async function span(name, action) {
    const startedAt = performance.now();
    writeLog({
      level: "info",
      event: "span.started",
      correlation_id: correlationId,
      operation,
      span: name,
    });

    try {
      const value = await action();
      const databaseError = value?.error;
      writeLog({
        level: databaseError ? "error" : "info",
        event: "span.finished",
        correlation_id: correlationId,
        operation,
        span: name,
        outcome: databaseError ? "error" : "success",
        duration_ms: Number((performance.now() - startedAt).toFixed(2)),
        ...(databaseError?.code ? { error_code: databaseError.code } : {}),
      });
      return value;
    } catch (error) {
      writeLog({
        level: "error",
        event: "span.finished",
        correlation_id: correlationId,
        operation,
        span: name,
        outcome: "error",
        duration_ms: Number((performance.now() - startedAt).toFixed(2)),
        error_code: error?.code || "UNEXPECTED_ERROR",
      });
      throw error;
    }
  }

  function finish(outcome, errorCode) {
    writeLog({
      level: outcome === "success" ? "info" : "error",
      event: "trace.finished",
      correlation_id: correlationId,
      operation,
      outcome,
      duration_ms: Number((performance.now() - traceStartedAt).toFixed(2)),
      ...(errorCode ? { error_code: errorCode } : {}),
    });
  }

  return { correlationId, span, finish };
}
