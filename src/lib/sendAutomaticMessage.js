import { supabase } from "./supabase";

export async function sendAutomaticMessage(requestId, message) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: userError || new Error("La sesión del administrador terminó.") };
  }

  return supabase.from("service_messages").insert({
    request_id: requestId,
    sender_id: user.id,
    sender_role: "admin",
    message,
  });
}
