import { Buffer } from "node:buffer";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createSecureHomeServer } from "../mcp/createServer.js";
import { publicOrigin, verifyAccessToken } from "../mcp/oauth.js";

const handler = createMcpHandler(createSecureHomeServer, { responseMode: "json" });

export default async function mcpEndpoint(req, res) {
  const origin = publicOrigin(req);
  if (!verifyAccessToken(req.headers.authorization)) {
    res.status(401).setHeader("WWW-Authenticate", `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`).json({ error: "No autorizado" });
    return;
  }

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
