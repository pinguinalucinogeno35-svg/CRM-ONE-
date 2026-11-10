import { createHmac, timingSafeEqual } from "node:crypto";

export type InboundLead = {
  phoneNumberId: string;
  name: string;
  phone: string;
  text: string;
  source: "whatsapp" | "anuncio";
  detail: string;
};

/** Confere o cabeçalho X-Hub-Signature-256 ("sha256=<hex>") contra o corpo bruto. */
export function isValidSignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const received = Buffer.from(header.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/**
 * Extrai as mensagens recebidas de uma notificação da WhatsApp Cloud API.
 * Notificações de status (entregue, lido) não têm "messages" e são ignoradas.
 */
export function parseWhatsAppLeads(payload: unknown): InboundLead[] {
  const body = obj(payload);
  if (body.object !== "whatsapp_business_account") return [];

  const leads: InboundLead[] = [];
  for (const entry of arr(body.entry)) {
    for (const change of arr(entry.changes)) {
      if (change.field !== "messages") continue;
      const value = obj(change.value);
      const phoneNumberId = str(obj(value.metadata).phone_number_id);
      if (!phoneNumberId) continue;

      const names = new Map<string, string>();
      for (const contact of arr(value.contacts)) {
        names.set(str(contact.wa_id), str(obj(contact.profile).name));
      }

      for (const message of arr(value.messages)) {
        const phone = str(message.from);
        if (!phone) continue;
        const referral = obj(message.referral);
        const fromAd = Object.keys(referral).length > 0;
        const headline = str(referral.headline);
        const url = str(referral.source_url);
        leads.push({
          phoneNumberId,
          name: names.get(phone) ?? "",
          phone,
          text: str(obj(message.text).body) || str(obj(message.button).text),
          source: fromAd ? "anuncio" : "whatsapp",
          detail: fromAd ? ["Anúncio", headline, url].filter(Boolean).join(" · ") : "",
        });
      }
    }
  }
  return leads;
}
