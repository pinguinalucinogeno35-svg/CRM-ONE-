export const STAGES = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em contato" },
  { value: "proposta", label: "Proposta" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
] as const;

export const TEMPERATURES = [
  { value: "quente", label: "Quente" },
  { value: "medio", label: "Médio" },
  { value: "frio", label: "Frio" },
] as const;

export const SOURCES = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "site", label: "Site" },
  { value: "anuncio", label: "Anúncio" },
  { value: "indicacao", label: "Indicação" },
  { value: "outro", label: "Outro" },
] as const;

export type Stage = (typeof STAGES)[number]["value"];
export type Temperature = (typeof TEMPERATURES)[number]["value"];
export type Source = (typeof SOURCES)[number]["value"];

export type Lead = {
  id: string;
  name: string;
  phone: string;
  reason: string;
  source: Source;
  temperature: Temperature;
  stage: Stage;
  notes: string;
  captured_via: CapturedVia;
  origin_detail: string;
  created_at: string;
};

export const CAPTURED_VIA = [
  { value: "manual", label: "Cadastro manual" },
  { value: "formulario", label: "Formulário público" },
  { value: "whatsapp", label: "Mensagem no WhatsApp" },
  { value: "lead_ads", label: "Formulário de anúncio" },
] as const;

export type CapturedVia = (typeof CAPTURED_VIA)[number]["value"];

export const LEAD_COLUMNS = 
  "id, name, phone, reason, source, temperature, stage, notes, captured_via, origin_detail, created_at";

const isOneOf = <T extends string>(list: readonly { value: T }[], v: unknown): v is T =>
  list.some((item) => item.value === v);

export const isStage = (v: unknown): v is Stage => isOneOf(STAGES, v);
export const isTemperature = (v: unknown): v is Temperature => isOneOf(TEMPERATURES, v);
export const isSource = (v: unknown): v is Source => isOneOf(SOURCES, v);

export const labelOf = (list: readonly { value: string; label: string }[], v: string) =>
  list.find((item) => item.value === v)?.label ?? v;

/** Mantém só os dígitos; aceita "(11) 91234-5678", "+55 11 ..." etc. */
export function normalizePhone(input: string) {
  return input.replace(/\D/g, "");
}

export function formatPhone(digits: string) {
  const local = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits;
}

export function whatsappUrl(digits: string) {
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}`;
}
