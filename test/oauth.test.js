import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createAuthorizationCode,
  createClientRegistration,
  exchangeAuthorizationCode,
  validateAuthorizationRequest,
  verifyAccessToken,
} from "../mcp/oauth.js";

process.env.MCP_OAUTH_SECRET = "test-secret-with-more-than-thirty-two-characters";

test("registra un cliente y valida una solicitud OAuth con PKCE", () => {
  const registration = createClientRegistration({
    client_name: "Codex",
    redirect_uris: ["https://chatgpt.com/connector/oauth/callback"],
  });
  const verifier = "a".repeat(64);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: registration.client_id,
    redirect_uri: registration.redirect_uris[0],
    response_type: "code",
    state: "state-123",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const request = validateAuthorizationRequest(params);
  assert.equal(request.clientName, "Codex");

  const code = createAuthorizationCode(request, { id: "admin-1", email: "admin@example.com" });
  const tokens = exchangeAuthorizationCode({
    code,
    clientId: registration.client_id,
    redirectUri: registration.redirect_uris[0],
    codeVerifier: verifier,
  });
  assert.equal(tokens.token_type, "Bearer");
  assert.equal(verifyAccessToken(`Bearer ${tokens.access_token}`).sub, "admin-1");
});

test("rechaza redirect URI o verificador PKCE diferentes", () => {
  const registration = createClientRegistration({ redirect_uris: ["https://example.com/callback"] });
  const verifier = "b".repeat(64);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const request = validateAuthorizationRequest(new URLSearchParams({
    client_id: registration.client_id,
    redirect_uri: "https://example.com/callback",
    response_type: "code",
    state: "state-456",
    code_challenge: challenge,
    code_challenge_method: "S256",
  }));
  const code = createAuthorizationCode(request, { id: "admin-2", email: "admin2@example.com" });
  assert.equal(exchangeAuthorizationCode({ code, clientId: registration.client_id, redirectUri: "https://attacker.example/callback", codeVerifier: verifier }), null);
  assert.equal(exchangeAuthorizationCode({ code, clientId: registration.client_id, redirectUri: request.redirectUri, codeVerifier: "c".repeat(64) }), null);
});
