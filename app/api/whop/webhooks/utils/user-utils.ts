/**
this is a utils file that works with the whop webhook that will find the clerk user id from the metadata that it gets from whop
for us to use later on with our database opperations

Finds the correct user in our database by extracting the Clerk user ID from the webhook data - this is critical because
 Whop uses different IDs than our database does.

 *
 * @param data The webhook data object from Whop
 * @returns The Clerk userId if found, undefined otherwise
 */
export function extractUserId(data: any): string | undefined {
  if (!data) {
    console.log("No data provided to extractUserId");
    return undefined;
  }
  
  // First check metadata - this is the most reliable source
  if (data.metadata) {
    console.log("Checking metadata for clerkUserId...");
    
    if (typeof data.metadata === 'object' && data.metadata !== null) {
      // Direct object access - most common case
      if (data.metadata.clerkUserId) {
        console.log(`Found clerkUserId in metadata: ${data.metadata.clerkUserId}`);
        return data.metadata.clerkUserId;
      }
      
      // Log all available metadata keys to help debugging
      console.log("Available metadata keys:", Object.keys(data.metadata));
      console.log("IMPORTANT: No explicit 'clerkUserId' found in metadata");
    } else if (typeof data.metadata === 'string') {
      // Handle string metadata that needs parsing
      try {
        console.log("Metadata is a string, attempting to parse as JSON");
        const parsedMetadata = JSON.parse(data.metadata);
        
        if (parsedMetadata.clerkUserId) {
          console.log(`Found clerkUserId in parsed metadata: ${parsedMetadata.clerkUserId}`);
          return parsedMetadata.clerkUserId;
        }
        
        console.log("IMPORTANT: No explicit 'clerkUserId' found in parsed metadata");
      } catch (e) {
        console.log("Failed to parse metadata as JSON:", e);
      }
    }
  } else {
    console.log("No metadata field found in webhook data");
  }
  
  // Check membership_metadata (common in payment events)
  if (data.membership_metadata) {
    console.log("Checking membership_metadata for clerkUserId...");
    
    if (typeof data.membership_metadata === 'object' && data.membership_metadata !== null) {
      if (data.membership_metadata.clerkUserId) {
        console.log(`Found clerkUserId in membership_metadata: ${data.membership_metadata.clerkUserId}`);
        return data.membership_metadata.clerkUserId;
      }
      
      // Log all available membership_metadata keys
      console.log("Available membership_metadata keys:", Object.keys(data.membership_metadata));
      console.log("IMPORTANT: No explicit 'clerkUserId' found in membership_metadata");
    }
  } else {
    console.log("No membership_metadata field found in webhook data");
  }
  
  // Explicitly note that the Whop user_id will NOT be used
  if (data.user_id) {
    console.log(`Note: Webhook contains Whop user_id ${data.user_id}, but we need a Clerk userId for database access`);
  }

  // Log all top-level fields in the webhook data to help with debugging
  console.log("All available top-level fields in webhook data:", Object.keys(data));
  
  // Check membership metadata if available
  if (data.membership && data.membership.metadata) {
    console.log("Checking nested membership.metadata...");
    
    if (data.membership.metadata.clerkUserId) {
      console.log(`Found clerkUserId in membership.metadata: ${data.membership.metadata.clerkUserId}`);
      return data.membership.metadata.clerkUserId;
    }
    
    console.log("IMPORTANT: No explicit 'clerkUserId' found in membership.metadata");
  }
  
  console.log("CRITICAL ERROR: Could not find Clerk userId in webhook data");
  console.log("This webhook cannot be properly processed without a Clerk userId");
  console.log("Ensure the checkout flow includes metadata with the 'clerkUserId' field");
  
  return undefined;
} 