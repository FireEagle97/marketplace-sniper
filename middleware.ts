import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

// This handles both payment provider use cases from whop-setup.md and stripe-setup.md
export default clerkMiddleware(async (auth, req) => {
  // Skip auth for webhook endpoints
  if (req.nextUrl.pathname.startsWith('/api/whop/webhooks')) {
    console.log("Skipping Clerk auth for Whop webhook endpoint");
    return NextResponse.next();
  }
  
  // Check for problematic URLs that might cause 431 errors
  // This covers both Clerk handshake params and payment provider redirects
  if (
    req.nextUrl.search && (
      req.nextUrl.search.includes('__clerk_handshake') ||
      req.nextUrl.search.includes('payment_intent') ||
      req.nextUrl.search.includes('checkout_id') ||
      req.nextUrl.search.includes('ref=') ||
      req.nextUrl.search.includes('client_reference_id=')
    )
  ) {
    // The URL contains parameters that might cause 431 errors
    // Instead of just letting it pass through, redirect to a clean URL
    // This prevents the accumulation of large cookies
    
    // Extract the base URL path without query parameters
    const cleanUrl = req.nextUrl.pathname;
    
    // Create a new URL object based on the current request
    const url = new URL(cleanUrl, req.url);
    
    // Important: Add a small cache-busting parameter to ensure the browser doesn't use cached data
    // This helps avoid cookie-related issues without adding significant query string size
    url.searchParams.set('cb', Date.now().toString().slice(-4));
    
    console.log(`Redirecting from problematic URL with large parameters to clean URL: ${url.toString()}`);
    
    // Return a redirect response to the clean URL
    return NextResponse.redirect(url);
  }

  // Special handling for frictionless payment flow
  // If a user has just completed signup after payment and is authenticated,
  // redirect them to the dashboard instead of keeping them on the signup page
  if (req.nextUrl.pathname.startsWith('/signup') && req.nextUrl.search.includes('payment=success')) {
    const { userId } = auth();
    
    // If user is authenticated and on signup page with payment=success, they should go to dashboard
    if (userId) {
      console.log("Frictionless payment user authenticated, redirecting to dashboard");
      const dashboardUrl = new URL('/dashboard', req.url);
      dashboardUrl.searchParams.set('payment', 'success');
      dashboardUrl.searchParams.set('cb', Date.now().toString().slice(-4));
      return NextResponse.redirect(dashboardUrl);
    }
  }

  const { userId, redirectToSignIn } = auth();

  // Standard route protection logic
  if (!userId && isProtectedRoute(req)) {
    // Return to dashboard after login instead of /login to avoid redirect loops
    return redirectToSignIn({ returnBackUrl: req.nextUrl.pathname });
  }

  if (userId && isProtectedRoute(req)) {
    return NextResponse.next();
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except for these:
    "/((?!api/whop/webhooks|_next/static|_next/image|favicon.ico).*)",
    "/"
  ]
};
