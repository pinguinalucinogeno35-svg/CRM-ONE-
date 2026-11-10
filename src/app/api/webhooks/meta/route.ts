import { createAdminClient } from "@/lib/supabase/admin";
import { isValidSignature, parseWhatsAppLeads } from "@/lib/meta-webhook";

/** Verificação do endereço, feita pela Meta ao cadastrar o webhook. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Mensagens recebidas no WhatsApp viram leads do cliente dono do número. */
export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET;
  const supabase = createAdminClient();
  if (!appSecret || !supabase) return new Response("Webhook not configured", { status: 503 });

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  let failed = false;
  for (const lead of parseWhatsAppLeads(payload)) {
    const { error } = await supabase.rpc("ingest_channel_lead", {
      p_kind: "whatsapp",
      p_external_id: lead.phoneNumberId,
      p_name: lead.name,
      p_phone: lead.phone,
      p_reason: lead.text,
      p_source: lead.source,
      p_detail: lead.detail,
    });
    if (error) failed = true;
  }

  // Um erro 5xx faz a Meta reenviar; a regra de duplicidade evita leads repetidos.
  return new Response(failed ? "Retry" : "OK", { status: failed ? 500 : 200 });
}
