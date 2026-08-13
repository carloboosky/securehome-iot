import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createSecureHomeServer } from "../mcp/createServer.js";

const handler = createMcpHandler(createSecureHomeServer, { responseMode: "json" });

function authorized(header) {
  const expected = process.env.MCP_ACCESS_TOKEN;
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function mcpEndpoint(req, res) {
  if (!authorized(req.headers.authorization)) {
    res.status(401).setHeader("WWW-Authenticate", "Bearer").json({ error: "No autorizado" });
    return;
  }

  const origin = `https://${req.headers.host || "securehome-iot.vercel.app"}`;
  const url = new URL(req.url || "/api/mcp", origin);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody && req.body !== undefined ? JSON.stringify(req.body) : undefined;
  const response = await handler.fetch(new Request(url, { method: req.method, headers, body }));

  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  const responseBody = await response.arrayBuffer();
  res.send(Buffer.from(responseBody));
}
