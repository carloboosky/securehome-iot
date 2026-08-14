import { publicOrigin, validateAuthorizationRequest } from "../mcp/oauth.js";

export default function authorizeEndpoint(req, res) {
  if (req.method !== "GET") return res.status(405).setHeader("Allow", "GET").end();
  const origin = publicOrigin(req);
  const requestUrl = new URL(req.url, origin);
  if (!validateAuthorizationRequest(requestUrl.searchParams)) return res.status(400).send("Solicitud OAuth inválida.");
  return res.redirect(302, `${origin}/autorizar-mcp?${requestUrl.searchParams.toString()}`);
}
