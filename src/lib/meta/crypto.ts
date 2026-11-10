import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// A chave é derivada do segredo do app da Meta, então não há outra variável
// para configurar. Se o segredo do app for trocado, as contas precisam ser
// conectadas de novo (os tokens antigos deixam de valer de qualquer forma).
function key(appSecret: string) {
  return Buffer.from(hkdfSync("sha256", appSecret, "crm-one", "social-token-v1", 32));
}

export function encryptToken(token: string, appSecret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(appSecret), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Devolve null se o texto foi adulterado ou cifrado com outro segredo. */
export function decryptToken(ciphertext: string, appSecret: string) {
  try {
    const [version, iv, tag, data] = ciphertext.split(".");
    if (version !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(appSecret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
