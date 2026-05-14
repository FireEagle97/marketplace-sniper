import { manageSubscriptionStatusChange, updateStripeCustomer } from "@/actions/stripe-actions";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import Stripe from "stripe";
import { updateProfile, updateProfileByStripeCustomerId, getProfileByStripeCustomerId } from "@/db/queries/profiles-queries";
import { clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";

const relevantEvents = new Set([
  "checkout.session.completed", 
  "customer.subscription.updated", 
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed"
]);

// Default usage credits for Pro plan
const DEFAULT_USAGE_CREDITS = 250;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = headers().get("Stripe-Signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      throw new Error("Webhook secret or signature missing");
    }

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case "customer.subscription.updated":
          await handleSubscriptionChange(event);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event);
          break;

        case "checkout.session.completed":
          await handleCheckoutSession(event);
          break;
          
        case "invoice.payment_succeeded":
          await handlePaymentSuccess(event);
          break;
          
        case "invoice.payment_failed":
          await handlePaymentFailed(event);
          break;

        default:
          throw new Error("Unhandled relevant event!");
      }
    } catch (error) {
      console.error("Webhook handler failed:", error);
      return new Response("Webhook handler failed. View your nextjs function logs.", {
        status: 400
      });
    }
  }

  return new Response(JSON.stringify({ received: true }));
}

async function handleSubscriptionChange(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const productId = subscription.items.data[0].price.product as string;
  await manageSubscriptionStatusChange(subscription.id, subscription.customer as string, productId);
}

async function handleCheckoutSession(event: Stripe.Event) {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  if (checkoutSession.mode === "subscription") {
    const subscriptionId = checkoutSession.subscription as string;
    await updateStripeCustomer(checkoutSession.client_reference_id as string, subscriptionId, checkoutSession.customer as string);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method"]
    });

    const productId = subscription.items.data[0].price.product as string;
    await manageSubscriptionStatusChange(subscription.id, subscription.customer as string, productId);

    // Reset usage credits on new subscription
    if (checkoutSession.client_reference_id) {
      try {
        const billingCycleStart = new Date(subscription.current_period_start * 1000);
        const billingCycleEnd = new Date(subscription.current_period_end * 1000);

        await updateProfile(checkoutSession.client_reference_id, {
          usageCredits: DEFAULT_USAGE_CREDITS,
          usedCredits: 0,
          status: "active",
          billingCycleStart,
          billingCycleEnd
        });

        console.log(`Reset usage credits to ${DEFAULT_USAGE_CREDITS} for user ${checkoutSession.client_reference_id}`);
      } catch (error) {
        console.error(`Error updating usage credits: ${error}`);
      }
    }

    // Update Clerk publicMetadata.plan to "paid"
    const userId = checkoutSession.metadata?.userId ?? checkoutSession.client_reference_id;
    if (userId) {
      try {
        const clerk = await clerkClient();
        await clerk.users.updateUserMetadata(userId, { publicMetadata: { plan: "paid" } });
        console.log(`Updated Clerk plan to "paid" for user ${userId}`);
      } catch (error) {
        console.error(`Error updating Clerk metadata: ${error}`);
      }
    }
  }
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  await handleSubscriptionChange(event);

  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  try {
    const profile = await getProfileByStripeCustomerId(customerId);
    if (profile?.userId) {
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(profile.userId, { publicMetadata: { plan: "free" } });
      console.log(`Updated Clerk plan to "free" for user ${profile.userId}`);
    }
  } catch (error) {
    console.error(`Error updating Clerk metadata on subscription deletion: ${error}`);
  }
}

async function handlePaymentSuccess(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;
  
  if (invoice.subscription) {
    try {
      // Get the subscription to determine billing cycle dates
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      
      const billingCycleStart = new Date(subscription.current_period_start * 1000);
      const billingCycleEnd = new Date(subscription.current_period_end * 1000);
      
      // Update profile directly by Stripe customer ID
      await updateProfileByStripeCustomerId(customerId, {
        usageCredits: DEFAULT_USAGE_CREDITS,
        usedCredits: 0,
        status: "active",
        billingCycleStart,
        billingCycleEnd
      });
      
      console.log(`Reset usage credits to ${DEFAULT_USAGE_CREDITS} for Stripe customer ${customerId}`);
    } catch (error) {
      console.error(`Error processing payment success: ${error}`);
    }
  }
}

async function handlePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;

  try {
    const updatedProfile = await updateProfileByStripeCustomerId(customerId, {
      status: "payment_failed"
    });

    if (updatedProfile) {
      console.log(`Marked payment as failed for user ${updatedProfile.userId}`);

      if (updatedProfile.email && process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: "FlipAlert <noreply@flipalert.com>",
            to: updatedProfile.email,
            subject: "Action required: payment failed",
            html: "<p>Your FlipAlert subscription payment failed. Please update your billing information to keep your alerts active.</p>",
          });
          console.log(`Sent payment failure email to ${updatedProfile.email}`);
        } catch (emailError) {
          console.error(`Error sending payment failure email: ${emailError}`);
        }
      }
    } else {
      console.error(`No profile found for Stripe customer: ${customerId}`);
    }
  } catch (error) {
    console.error(`Error processing payment failure: ${error}`);
  }
}
