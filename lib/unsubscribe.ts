import crypto from "crypto";

export function buildUnsubscribeToken(userId: string): string {
  const payload = Buffer.from(userId).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.UNSUBSCRIBE_SECRET!)
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}
