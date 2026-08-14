import { Buffer } from "node:buffer";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createSecureHomeDemoServer } from "../mcp/createDemoServer.js";

const handler = createMcpHandler(createSecureHomeDemoServer, { responseMode: "json" });

export default async function demoMcpEndpoint(req, res) {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("X-SecureHome-Demo", "true");
    return res.status(200).json({
      name: "SecureHome IoT Demo",
      description: "Demostración académica pública con datos ficticios. No consulta Supabase ni expone información real.",
      mcp_endpoint: "https://securehome-iot.vercel.app/api/mcp-demo",
      transport: "Streamable HTTP",
      tools: ["list-clients", "get-security-overview", "list-cameras", "get-household"],
      demo_users: ["Familia Demo", "Residente Demo"],
      sample_request_id: "11111111-1111-4111-8111-111111111111",
      note: "Los clientes MCP usan POST. Esta respuesta GET existe para revisión humana y asistentes con navegación web.",
    });
  }

  const origin = `https://${req.headers.host || "securehome-iot.vercel.app"}`;
  const url = new URL(req.url || "/api/mcp-demo", origin);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
  }
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody && req.body !== undefined ? JSON.stringify(req.body) : undefined;
  const response = await handler.fetch(new Request(url, { method: req.method, headers, body }));

  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.setHeader("X-SecureHome-Demo", "true");
  const responseBody = await response.arrayBuffer();
  res.send(Buffer.from(responseBody));
}
