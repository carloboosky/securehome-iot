import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createSecureHomeServer } from "./createServer.js";

serveStdio(createSecureHomeServer, {
  onerror(error) { console.error(`Error del transporte MCP: ${error.message}`); },
});
console.error("SecureHome MCP está esperando un cliente mediante stdio.");
