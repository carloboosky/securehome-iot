import { supabase } from "./supabase";

const CAMERA_API_ORIGIN = "https://iot-security.pro";
const SECURE_STREAM_URL = `${CAMERA_API_ORIGIN}/api/camera/stream`;

function normalizeStreamUrl(configuredUrl) {
  const trimmedUrl = configuredUrl?.trim();
  if (!trimmedUrl) return "";
  return trimmedUrl;
}

function isProtectedBackendStream(streamUrl) {
  try {
    const url = new URL(streamUrl);
    return url.origin === CAMERA_API_ORIGIN && url.pathname === "/api/camera/stream";
  } catch {
    return false;
  }
}

export async function getSecureCameraStreamUrl(configuredUrl) {
  const streamUrl = normalizeStreamUrl(configuredUrl);
  if (!streamUrl) throw new Error("Esta cámara todavía no tiene una dirección configurada.");

  // Nunca enviamos el token temporal de AWS a cámaras o proveedores externos.
  if (!isProtectedBackendStream(streamUrl)) return streamUrl;

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error("Tu sesión caducó. Inicia sesión nuevamente para ver la cámara.");
  }

  const response = await fetch(`${CAMERA_API_ORIGIN}/api/camera/stream-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Tu usuario no está autorizado para ver esta cámara.");
    }
    throw new Error("No se pudo obtener el acceso seguro a la cámara.");
  }

  const data = await response.json();
  const streamToken = data.streamToken || data.stream_token || data.token;
  if (!streamToken) throw new Error("El servidor no devolvió el token temporal de la cámara.");

  const finalUrl = new URL(streamUrl);
  finalUrl.searchParams.set("token", streamToken);
  return finalUrl.toString();
}

export const PRIMARY_CAMERA_STREAM_URL = SECURE_STREAM_URL;
