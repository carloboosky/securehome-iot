import { exchangeAuthorizationCode, exchangeRefreshToken, noStore, parseBody } from "../mcp/oauth.js";

export default function tokenEndpoint(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).setHeader("Allow", "POST").json({ error: "method_not_allowed" });
  const body = parseBody(req);
  let tokens;
  if (body.grant_type === "authorization_code") {
    tokens = exchangeAuthorizationCode({ code: body.code, clientId: body.client_id, redirectUri: body.redirect_uri, codeVerifier: body.code_verifier });
  } else if (body.grant_type === "refresh_token") {
    tokens = exchangeRefreshToken(body.refresh_token, body.client_id);
  } else {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }
  return tokens ? res.status(200).json(tokens) : res.status(400).json({ error: "invalid_grant" });
}
