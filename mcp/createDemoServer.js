import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const demoRequestId = "11111111-1111-4111-8111-111111111111";
const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const clients = [
  {
    id: demoRequestId,
    status: "pending",
    property_type: "Casa",
    installation_address: "Sector residencial de demostración, Quito",
    created_at: "2026-08-13T08:00:00.000Z",
    profiles: { full_name: "Familia Demo", phone: "099-000-0000" },
    service_plans: { name: "Protección Familiar" },
  },
];

function result(data) {
  return { content: [{ type: "text", text: JSON.stringify({ demo: true, data }, null, 2) }] };
}

function validateRequest(requestId) {
  return requestId === demoRequestId;
}

export function createSecureHomeDemoServer() {
  const server = new McpServer({ name: "securehome-iot-demo", version: "1.0.0" });

  server.registerTool("list-clients", {
    description: "Lista solicitudes ficticias de SecureHome para demostración académica.",
    annotations: readOnlyAnnotations,
    inputSchema: z.object({
      status: z.union([z.enum(["pending", "contacted", "scheduled", "installed", "cancelled"]), z.literal("")]).optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  }, async ({ status, limit }) => result(clients.filter(client => !status || client.status === status).slice(0, limit)));

  server.registerTool("get-security-overview", {
    description: "Muestra un resumen ficticio de seguridad residencial para la demostración.",
    annotations: readOnlyAnnotations,
    inputSchema: z.object({ requestId: z.uuid() }),
  }, async ({ requestId }) => result(validateRequest(requestId) ? {
    request: clients[0],
    activeCameras: [{ id: "camera-demo-1", location: "Entrada principal", is_active: true }],
    residents: [{ id: "resident-demo-1", full_name: "Residente Demo", role: "Propietario", is_at_home: true }],
    pets: [{ id: "pet-demo-1", name: "Max", type: "Perro" }],
    cameraDesign: { model: "SecureCam Demo", color: "Negro", mount_type: "Pared" },
    inferredHomeMode: "EN_CASA",
  } : { error: "Solicitud de demostración no encontrada", availableRequestId: demoRequestId }));

  server.registerTool("list-cameras", {
    description: "Lista cámaras ficticias de la demostración SecureHome.",
    annotations: readOnlyAnnotations,
    inputSchema: z.object({ requestId: z.uuid() }),
  }, async ({ requestId }) => result(validateRequest(requestId) ? [
    { id: "camera-demo-1", location: "Entrada principal", is_active: true, status: "En línea" },
    { id: "camera-demo-2", location: "Patio", is_active: true, status: "En línea" },
  ] : []));

  server.registerTool("get-household", {
    description: "Consulta residentes y mascotas ficticios de la demostración.",
    annotations: readOnlyAnnotations,
    inputSchema: z.object({ requestId: z.uuid() }),
  }, async ({ requestId }) => result(validateRequest(requestId) ? {
    residents: [{ id: "resident-demo-1", full_name: "Residente Demo", role: "Propietario", is_at_home: true }],
    pets: [{ id: "pet-demo-1", name: "Max", type: "Perro" }],
  } : { residents: [], pets: [] }));

  return server;
}
