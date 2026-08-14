import { Buffer } from "node:buffer";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createSecureHomeDemoServer } from "../mcp/createDemoServer.js";

const handler = createMcpHandler(createSecureHomeDemoServer, { responseMode: "json" });

export default async function demoMcpEndpoint(req, res) {
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
