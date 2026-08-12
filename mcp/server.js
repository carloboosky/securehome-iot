import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createClient } from "@supabase/supabase-js";
import * as z from "zod/v4";
import { createTrace } from "./observability.js";

const supabaseUrl = process.env.MCP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.MCP_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Configura MCP_SUPABASE_URL y MCP_SUPABASE_SERVICE_ROLE_KEY antes de iniciar SecureHome MCP.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function result(data, correlationId) {
  const payload = correlationId ? { correlationId, data } : data;
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function failure(message, correlationId) {
  const payload = correlationId ? { correlationId, error: message } : message;
  return {
    content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }],
    isError: true,
  };
}

function createServer() {
  const server = new McpServer({ name: "securehome-iot", version: "1.0.0" });

  server.registerTool("list-clients", {
    description: "Lista las solicitudes de clientes de SecureHome con su plan, estado e información de contacto.",
    inputSchema: z.object({
      status: z.union([
        z.enum(["pending", "contacted", "scheduled", "installed", "cancelled"]),
        z.literal(""),
      ]).optional().describe("Filtrar por estado; dejar vacío para mostrar todos"),
      limit: z.number().int().min(1).max(100).default(20).describe("Cantidad máxima de resultados"),
    }),
  }, async ({ status, limit }) => {
    let query = supabase.from("service_requests")
      .select("id,status,property_type,installation_address,created_at,profiles(full_name,phone),service_plans(name)")
      .order("created_at", { ascending: false }).limit(limit);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    return error ? failure(`No se pudieron consultar los clientes: ${error.message}`) : result(data);
  });

  server.registerTool("get-security-overview", {
    description: "Obtiene un resumen de cámaras, residentes, mascotas y diseño para una solicitud. El modo se infiere por la presencia de residentes.",
    inputSchema: z.object({
      requestId: z.uuid().describe("UUID de la solicitud de servicio"),
      correlationId: z.uuid().optional().describe("UUID opcional para correlacionar la solicitud de extremo a extremo"),
    }),
  }, async ({ requestId, correlationId }) => {
    const trace = createTrace("get-security-overview", correlationId);
    try {
      const [request, cameras, residents, pets, design] = await Promise.all([
        trace.span("database.service_requests.select", () => supabase.from("service_requests").select("id,status,property_type,installation_address,service_plans(name),profiles(full_name,phone)").eq("id", requestId).maybeSingle()),
        trace.span("database.camera_devices.select", () => supabase.from("camera_devices").select("id,stream_url,is_active,updated_at").eq("request_id", requestId).eq("is_active", true)),
        trace.span("database.residents.select", () => supabase.from("residents").select("id,full_name,role,is_at_home").eq("request_id", requestId).order("created_at")),
        trace.span("database.pets.select", () => supabase.from("pets").select("id,name,type").eq("request_id", requestId).order("created_at")),
        trace.span("database.camera_design.select", () => supabase.from("camera_design_selections").select("model,color,mount_type,notes").eq("request_id", requestId).maybeSingle()),
      ]);
      const firstError = [request, cameras, residents, pets, design].find(response => response.error)?.error;
      if (firstError) {
        trace.finish("error", firstError.code || "DATABASE_ERROR");
        return failure(`No se pudo crear el resumen: ${firstError.message}`, trace.correlationId);
      }
      const residentList = residents.data || [];
      const inferredMode = residentList.length === 0
        ? "SIN_RESIDENTES_REGISTRADOS"
        : residentList.every(person => !person.is_at_home) ? "AUSENTE" : "EN_CASA";
      trace.finish("success");
      return result({
        request: request.data,
        activeCameras: cameras.data || [],
        residents: residentList,
        pets: pets.data || [],
        cameraDesign: design.data,
        inferredHomeMode: inferredMode,
      }, trace.correlationId);
    } catch (error) {
      trace.finish("error", error?.code || "UNEXPECTED_ERROR");
      return failure("No se pudo crear el resumen por un error inesperado.", trace.correlationId);
    }
  });

  server.registerTool("list-cameras", {
    description: "Lista las cámaras activas asignadas a una solicitud de SecureHome.",
    inputSchema: z.object({ requestId: z.uuid().describe("UUID de la solicitud de servicio") }),
  }, async ({ requestId }) => {
    const { data, error } = await supabase.from("camera_devices")
      .select("id,stream_url,is_active,updated_at").eq("request_id", requestId).eq("is_active", true).order("updated_at");
    return error ? failure(`No se pudieron consultar las cámaras: ${error.message}`) : result(data);
  });

  server.registerTool("get-household", {
    description: "Consulta los residentes y mascotas registrados para una solicitud, sin modificar su estado.",
    inputSchema: z.object({ requestId: z.uuid().describe("UUID de la solicitud de servicio") }),
  }, async ({ requestId }) => {
    const [residents, pets] = await Promise.all([
      supabase.from("residents").select("id,full_name,role,is_at_home").eq("request_id", requestId).order("created_at"),
      supabase.from("pets").select("id,name,type").eq("request_id", requestId).order("created_at"),
    ]);
    if (residents.error || pets.error) return failure(`No se pudo consultar el hogar: ${residents.error?.message || pets.error?.message}`);
    return result({ residents: residents.data || [], pets: pets.data || [] });
  });

  return server;
}

serveStdio(createServer, {
  onerror(error) {
    console.error(`Error del transporte MCP: ${error.message}`);
  },
});
console.error("SecureHome MCP está esperando un cliente mediante stdio.");
