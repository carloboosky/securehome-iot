import { createClient } from "@supabase/supabase-js";
import { createAuthorizationCode, noStore, parseBody, validateAuthorizationRequest } from "../mcp/oauth.js";

export default async function approveEndpoint(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).setHeader("Allow", "POST").json({ error: "method_not_allowed" });
  const body = parseBody(req);
  const request = validateAuthorizationRequest(new URLSearchParams(body.oauthParams || ""));
  if (!request) return res.status(400).json({ error: "invalid_request" });

  const accessToken = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  const supabase = createClient(process.env.MCP_SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.MCP_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return res.status(401).json({ error: "login_required" });

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profileError || profile?.role?.trim().toLowerCase() !== "admin") return res.status(403).json({ error: "access_denied", message: "Solo administradores pueden autorizar este MCP." });

  const code = createAuthorizationCode(request, userData.user);
  const callback = new URL(request.redirectUri);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", request.state);
  return res.status(200).json({ redirectTo: callback.toString() });
}
