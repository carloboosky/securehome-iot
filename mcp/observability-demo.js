import { setTimeout as wait } from "node:timers/promises";
import { createTrace } from "./observability.js";

async function normalCase() {
  const trace = createTrace("get-security-overview", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await trace.span("database.service_requests.select", async () => {
    await wait(20);
    return { data: { id: "demo-request" }, error: null };
  });
  trace.finish("success");
}

async function degradedCase() {
  const trace = createTrace("get-security-overview", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  const response = await trace.span("database.camera_devices.select", async () => {
    await wait(200);
    return { data: null, error: { code: "PGRST301" } };
  });
  trace.finish("error", response.error.code);
}

await normalCase();
await degradedCase();
