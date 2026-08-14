import { createClientRegistration, noStore, parseBody } from "../mcp/oauth.js";

export default function registerEndpoint(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).setHeader("Allow", "POST").json({ error: "method_not_allowed" });
  const registration = createClientRegistration(parseBody(req));
  if (!registration) return res.status(400).json({ error: "invalid_client_metadata" });
  return res.status(201).json(registration);
}
