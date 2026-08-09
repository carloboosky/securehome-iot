import assert from "node:assert/strict";
import test from "node:test";
import { createTrace } from "../mcp/observability.js";

async function captureLogs(action) {
  const originalWrite = process.stderr.write;
  const lines = [];
  process.stderr.write = (chunk) => {
    lines.push(String(chunk));
    return true;
  };
  try {
    await action();
  } finally {
    process.stderr.write = originalWrite;
  }
  return lines.join("").trim().split("\n").filter(Boolean).map(JSON.parse);
}

test("preserva el correlation ID en toda la traza exitosa", async () => {
  const correlationId = "11111111-1111-4111-8111-111111111111";
  const logs = await captureLogs(async () => {
    const trace = createTrace("get-security-overview", correlationId);
    await trace.span("database.service_requests.select", async () => ({ data: { id: "request-1" }, error: null }));
    trace.finish("success");
  });

  assert.equal(logs.length, 4);
  assert.ok(logs.every(entry => entry.correlation_id === correlationId));
  assert.deepEqual(logs.map(entry => entry.event), [
    "trace.started", "span.started", "span.finished", "trace.finished",
  ]);
  assert.equal(logs.at(-1).outcome, "success");
  assert.equal(typeof logs.at(-1).duration_ms, "number");
});

test("registra el span y la traza fallidos con código de error", async () => {
  const logs = await captureLogs(async () => {
    const trace = createTrace("get-security-overview", "22222222-2222-4222-8222-222222222222");
    const response = await trace.span("database.camera_devices.select", async () => ({
      data: null,
      error: { code: "PGRST301" },
    }));
    trace.finish("error", response.error.code);
  });

  const finishedSpan = logs.find(entry => entry.event === "span.finished");
  assert.equal(finishedSpan.outcome, "error");
  assert.equal(finishedSpan.error_code, "PGRST301");
  assert.equal(logs.at(-1).outcome, "error");
});
