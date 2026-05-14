# Webhook Route Migration Plan

## Objective

Break up the monolithic `app/api/whop/webhooks/route.ts` file into modular utility files while maintaining exact functionality.

## Proposed File Structure

```
app/api/whop/webhooks/
├── route.ts                    # Main webhook handler (simplified)
├── utils/
│   ├── constants.ts            # Constants used across webhook handlers
│   ├── user-utils.ts           # User ID extraction and related utilities
│   ├── plan-utils.ts           # Plan type determination functions
│   ├── payment-handlers.ts     # Payment success/failure handlers
│   ├── membership-handlers.ts  # Membership status change handlers
│   └── path-utils.ts           # Path revalidation utility functions
```

## Migration Steps

1. Create the utils directory and utility files
2. Extract constants to constants.ts
3. Move helper functions to appropriate utility files
4. Extract handlers to their specific files
5. Update route.ts to import and use these utilities
6. Test to ensure functionality remains identical

## File Contents

### constants.ts
- `DEFAULT_USAGE_CREDITS`
- `CREDIT_RENEWAL_DAYS`

### user-utils.ts 
- `extractUserId` function

### plan-utils.ts
- `determinePlanType` function

### payment-handlers.ts
- `handlePaymentSuccess` function
- Payment-related utility functions

### membership-handlers.ts
- `handleMembershipChange` function
- Membership status change related utilities

### path-utils.ts
- Revalidation path constants
- Helper function for revalidating common paths

### route.ts (updated)
- Simplified to import and use utilities
- Core webhook handling logic
- Event routing to appropriate handlers

## Implementation Guidelines

1. **Maintain Imports**: Ensure all necessary imports are maintained in each file
2. **Preserve Error Handling**: Keep all error handling intact
3. **Export/Import Types**: Create types for shared data structures
4. **No Functional Changes**: The system should work exactly as before
5. **Clean Interfaces**: Define clear interfaces between components
6. **Consistent Logging**: Maintain the same logging pattern

## Testing Approach

1. Manual test of each webhook event type
2. Verify all database operations work as expected
3. Confirm subscription status changes correctly
4. Ensure credit system behaves identically

## Rollback Plan

If issues arise, revert to the original monolithic file until problems can be addressed.
