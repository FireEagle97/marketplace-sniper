import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PAID_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "STRIPE_PAID_PRICE_ID not configured" }, { status: 500 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId,
    metadata: { userId },
    ...(email ? { customer_email: email } : {}),
    success_url: `${baseUrl}/dashboard`,
    cancel_url: `${baseUrl}/`,
  });

  return NextResponse.json({ url: session.url });
}
