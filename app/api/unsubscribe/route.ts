import { clerkClient } from "@clerk/nextjs/server";
import crypto from "crypto";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token || !process.env.UNSUBSCRIBE_SECRET) {
    return new Response(invalidHtml(), { status: 400, headers: { "Content-Type": "text/html" } });
  }

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) {
    return new Response(invalidHtml(), { status: 400, headers: { "Content-Type": "text/html" } });
  }

  const payload = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  const expected = crypto
    .createHmac("sha256", process.env.UNSUBSCRIBE_SECRET)
    .update(payload)
    .digest("hex");

  const isValid = (() => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  })();

  if (!isValid) {
    return new Response(invalidHtml(), { status: 400, headers: { "Content-Type": "text/html" } });
  }

  const userId = Buffer.from(payload, "base64url").toString("utf-8");

  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { digestUnsubscribed: true },
    });
  } catch (error) {
    console.error("Unsubscribe clerkClient error:", error);
    return new Response(errorHtml(), { status: 500, headers: { "Content-Type": "text/html" } });
  }

  return new Response(successHtml(), { status: 200, headers: { "Content-Type": "text/html" } });
}

function successHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center">
  <h1>You've been unsubscribed</h1>
  <p>You'll no longer receive digest emails from FlipAlert.</p>
  <p><a href="/">Manage your alerts</a></p>
</body></html>`;
}

function invalidHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invalid Link</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center">
  <h1>Invalid unsubscribe link</h1>
  <p>This link is invalid or has expired.</p>
</body></html>`;
}

function errorHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center">
  <h1>Something went wrong</h1>
  <p>Please try again later or contact support.</p>
</body></html>`;
}
