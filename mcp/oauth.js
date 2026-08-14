import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const issuerPath = "/api/oauth";
const accessTokenLifetimeSeconds = 60 * 60;
const authorizationCodeLifetimeSeconds = 5 * 60;

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function oauthSecret() {
  const secret = process.env.MCP_OAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MCP_OAUTH_SECRET debe tener al menos 32 caracteres.");
  }
  return secret;
}

function signature(value) {
  return createHmac("sha256", oauthSecret()).update(value).digest("base64url");
}

export function signPayload(payload) {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${signature(encoded)}`;
}

export function verifyPayload(token, expectedType) {
  if (typeof token !== "string") return null;
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return null;
  const expectedSignature = signature(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64url(encoded));
    if (payload.type !== expectedType || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function publicOrigin(req) {
  const configured = process.env.MCP_PUBLIC_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${req.headers.host || "securehome-iot.vercel.app"}`;
}

export function oauthMetadata(origin) {
  return {
    issuer: `${origin}${issuerPath}`,
    authorization_endpoint: `${origin}${issuerPath}/authorize`,
    token_endpoint: `${origin}${issuerPath}/token`,
    registration_endpoint: `${origin}${issuerPath}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp:tools"],
  };
}

export function protectedResourceMetadata(origin) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [`${origin}${issuerPath}`],
    scopes_supported: ["mcp:tools"],
    bearer_methods_supported: ["header"],
  };
}

function validRedirectUri(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
}

export function createClientRegistration(body) {
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
  if (!redirectUris.length || redirectUris.some(uri => !validRedirectUri(uri))) return null;
  const now = Math.floor(Date.now() / 1000);
  const clientData = {
    type: "client",
    client_name: String(body.client_name || "Cliente MCP").slice(0, 100),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    iat: now,
    exp: now + 30 * 24 * 60 * 60,
  };
  return { ...clientData, client_id: signPayload(clientData), client_id_issued_at: now };
}

export function validateAuthorizationRequest(params) {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const responseType = params.get("response_type");
  const scope = params.get("scope") || "mcp:tools";
  const client = verifyPayload(clientId, "client");

  if (!client || !client.redirect_uris.includes(redirectUri) || responseType !== "code" || !state || !codeChallenge || codeChallengeMethod !== "S256") return null;
  return { clientId, clientName: client.client_name, redirectUri, state, codeChallenge, scope };
}

export function createAuthorizationCode(request, user) {
  const now = Math.floor(Date.now() / 1000);
  return signPayload({
    type: "authorization_code",
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    code_challenge: request.codeChallenge,
    scope: request.scope,
    sub: user.id,
    email: user.email,
    nonce: randomBytes(16).toString("base64url"),
    iat: now,
    exp: now + authorizationCodeLifetimeSeconds,
  });
}

function matchesPkce(verifier, challenge) {
  if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) return false;
  const calculated = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(calculated);
  const b = Buffer.from(challenge || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier }) {
  const payload = verifyPayload(code, "authorization_code");
  if (!payload || payload.client_id !== clientId || payload.redirect_uri !== redirectUri || !matchesPkce(codeVerifier, payload.code_challenge)) return null;
  return createTokens(payload);
}

function createTokens(subject) {
  const now = Math.floor(Date.now() / 1000);
  const common = { sub: subject.sub, email: subject.email, client_id: subject.client_id, scope: subject.scope || "mcp:tools" };
  return {
    access_token: signPayload({ type: "access_token", ...common, iat: now, exp: now + accessTokenLifetimeSeconds }),
    token_type: "Bearer",
    expires_in: accessTokenLifetimeSeconds,
    scope: common.scope,
    refresh_token: signPayload({ type: "refresh_token", ...common, nonce: randomBytes(16).toString("base64url"), iat: now, exp: now + 30 * 24 * 60 * 60 }),
  };
}

export function exchangeRefreshToken(refreshToken, clientId) {
  const payload = verifyPayload(refreshToken, "refresh_token");
  if (!payload || payload.client_id !== clientId) return null;
  return createTokens(payload);
}

export function verifyAccessToken(header) {
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  return verifyPayload(supplied, "access_token");
}

export function parseBody(req) {
  if (typeof req.body === "string") {
    const type = req.headers["content-type"] || "";
    if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(req.body));
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

export function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}
