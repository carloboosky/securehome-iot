import { supabase } from "./supabase";

const CAMERA_API_ORIGIN = "https://iot-security.pro";
const SECURE_STREAM_URL = `${CAMERA_API_ORIGIN}/api/camera/stream`;
const STREAM_TOKEN_CACHE_MS = 8 * 60 * 1000;

// Cada cámara conserva su propio acceso. Compartir una única caché hacía que
// algunos backends reutilizaran el stream de la cámara 1 al abrir la cámara 2.
const streamAccessByCamera = new Map();

function normalizeStreamUrl(configuredUrl) {
  const trimmedUrl = configuredUrl?.trim();
  if (!trimmedUrl) return "";
  return trimmedUrl;
}

function isProtectedBackendStream(streamUrl) {
  try {
    const url = new URL(streamUrl);
    return url.origin === CAMERA_API_ORIGIN && /^\/api\/camera\/stream\d*\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export async function getSecureCameraStreamUrl(configuredUrl, { forceRefresh = false } = {}) {
  const streamUrl = normalizeStreamUrl(configuredUrl);
  if (!streamUrl) throw new Error("Esta cámara todavía no tiene una dirección configurada.");

  // Nunca enviamos el token temporal de AWS a cámaras o proveedores externos.
  if (!isProtectedBackendStream(streamUrl)) return streamUrl;

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error("Tu sesión caducó. Inicia sesión nuevamente para ver la cámara.");
  }

  const cacheKey = `${session.user.id}:${streamUrl}`;
  let cameraAccess = streamAccessByCamera.get(cacheKey);
  const canReuseToken = !forceRefresh
    && cameraAccess?.token
    && cameraAccess.accessToken === session.access_token
    && Date.now() < cameraAccess.expiresAt;

  if (!canReuseToken) {
    if (!cameraAccess?.request) {
      const request = fetch(`${CAMERA_API_ORIGIN}/api/camera/stream-token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stream_url: streamUrl }),
      }).then(async response => {
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Tu usuario no está autorizado para ver esta cámara.");
          }
          throw new Error("No se pudo obtener el acceso seguro a la cámara.");
        }

        const data = await response.json();
        const streamToken = data.streamToken || data.stream_token || data.token;
        if (!streamToken) throw new Error("El servidor no devolvió el token temporal de la cámara.");

        streamAccessByCamera.set(cacheKey, {
          token: streamToken,
          accessToken: session.access_token,
          expiresAt: Date.now() + STREAM_TOKEN_CACHE_MS,
          request: null,
        });
        return streamToken;
      }).finally(() => {
        const latestAccess = streamAccessByCamera.get(cacheKey);
        if (latestAccess?.request) {
          streamAccessByCamera.set(cacheKey, { ...latestAccess, request: null });
        }
      });
      cameraAccess = { ...cameraAccess, request };
      streamAccessByCamera.set(cacheKey, cameraAccess);
    }
    await streamAccessByCamera.get(cacheKey).request;
  }

  cameraAccess = streamAccessByCamera.get(cacheKey);
  const finalUrl = new URL(streamUrl);
  finalUrl.searchParams.set("token", cameraAccess.token);
  finalUrl.searchParams.set("t", Date.now().toString());
  return finalUrl.toString();
}

export const PRIMARY_CAMERA_STREAM_URL = SECURE_STREAM_URL;
