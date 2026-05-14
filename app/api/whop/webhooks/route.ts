import { makeWebhookHandler } from "@whop-apps/sdk";
import { checkDatabaseConnection } from "@/db/db";
import { NextResponse } from "next/server";

// Import utility functions
import { handlePaymentSuccess, handlePaymentFailed } from "./utils/payment-handlers";
import { handleMembershipChange } from "./utils/membership-handlers";

// Create the webhook handler at the module level
const handleWebhook = makeWebhookHandler();

/**
 * Main webhook handler function
 * Receives events from Whop and routes them to the appropriate handlers
 * 
 * Note: This routes to payment-handlers.ts which now delegates frictionless payments
 * to frictionless-payment-handlers.ts based on the presence of email in metadata
 */
export async function POST(req: Request) {
  console.log("Received Whop webhook event");
  
  try {
    // Log the raw request body for debugging
    const rawBody = await req.text();
    console.log("Raw webhook body:", rawBody);
    
    // Convert back to request for the handler
    const newReq = new Request(req.url, {
      headers: req.headers,
      method: req.method,
      body: rawBody
    });
    
    // Check database connection health
    let dbStatus;
    try {
      dbStatus = await checkDatabaseConnection();
    } catch (dbError) {
      console.error(`Error checking database connection:`, dbError);
      dbStatus = { ok: false, message: "Database connection check failed" };
    }
    
    if (!dbStatus.ok) {
      console.error(`Database connection issue: ${dbStatus.message}`);
      // Even with DB issues, we return 200 to Whop to avoid retries
      return new Response(JSON.stringify({ 
        status: "warning", 
        message: "Database connection unavailable, event will not be processed" 
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // Process the webhook with error handling for each handler function
    try {
      return handleWebhook(newReq, {
        // When a membership becomes invalid
        membershipWentInvalid(event) {
          try {
            console.log(`[route.ts] Processing 'membershipWentInvalid' event`);
            console.log(`[route.ts] Event action: ${event.action}`);
            console.log(`[route.ts] Full event data:`, JSON.stringify(event, null, 2));
            handleMembershipChange(event.data, false);
          } catch (error) {
            console.error(`[route.ts] Error in membershipWentInvalid handler:`, error);
            // Don't rethrow, let the webhook complete successfully
          }
        },
        
        // When a payment is successfully processed
        paymentSucceeded(event) {
          try {
            console.log(`[route.ts] Processing 'paymentSucceeded' event`);
            console.log(`[route.ts] Event action: ${event.action}`);
            console.log(`[route.ts] Full event data:`, JSON.stringify(event, null, 2));
            handlePaymentSuccess(event.data);
          } catch (error) {
            console.error(`[route.ts] Error in paymentSucceeded handler:`, error);
            // Don't rethrow, let the webhook complete successfully
          }
        },
        
        // When a payment fails
        paymentFailed(event) {
          try {
            console.log(`[route.ts] Payment failed for membership: ${event.data.id}`);
            console.log(`[route.ts] Event action: ${event.action}`);
            console.log(`[route.ts] Full event data:`, JSON.stringify(event, null, 2));
            
            // Handle payment failure
            handlePaymentFailed(event.data);
          } catch (error) {
            console.error(`[route.ts] Error in paymentFailed handler:`, error);
            // Don't rethrow, let the webhook complete successfully
          }
        }
      });
    } catch (webhookError) {
      console.error("Error in Whop webhook handler:", webhookError);
      // Return 200 even if there's an error in the webhook handler itself
      return new Response(JSON.stringify({ 
        status: "error", 
        message: "Webhook handler error but acknowledging receipt" 
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error("Error processing Whop webhook:", error);
    // Always return 200 status to Whop even for errors
    return new Response(JSON.stringify({ 
      status: "error", 
      message: "Webhook processing error but acknowledging receipt" 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
} 