import "server-only";

/** Versão da Graph API usada em todas as chamadas. Conferida na documentação em nov/2026. */
export const GRAPH_VERSION = "v27.0";

/**
 * Permissões pedidas no login. Todas exigem App Review para contas que não
 * sejam administradoras ou testadoras do app.
 */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "read_insights",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
];

export type MetaConfig = {
  appId: string;
  appSecret: string;
  /** ID da configuração do Facebook Login for Business; quando existe, substitui a lista de permissões. */
  loginConfigId: string | null;
  graphUrl: string;
  dialogUrl: string;
};

export function metaConfig(): MetaConfig | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  return {
    appId,
    appSecret,
    loginConfigId: /^[0-9]{5,30}$/.test(process.env.META_LOGIN_CONFIG_ID ?? "") ? process.env.META_LOGIN_CONFIG_ID! : null,
    // Sobrescritos apenas em testes locais, com um simulador da API.
    graphUrl: (process.env.META_GRAPH_URL ?? "https://graph.facebook.com").replace(/\/$/, ""),
    dialogUrl: (process.env.META_DIALOG_URL ?? "https://www.facebook.com").replace(/\/$/, ""),
  };
}
