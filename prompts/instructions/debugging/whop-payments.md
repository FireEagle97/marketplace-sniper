# Whop Payments Debugging

## Required Tasks

1. **Welcome Message for Free Plan**
   - When users signup on a free plan and they're first-time users
   - Show a welcome message popup
   - Explain how many credits they get in their free plan

2. **User Status for Free Plan**
   - Instead of setting free users to "active" (as they're not paying)
   - Need to determine if we should set this to something else

3. **Authentication Redirect**
   - When users signup/signin, auto-direct to the dashboard page
   - Currently stays on home page

4. **Plan Type Tracking**
   - Track monthly/yearly plan in the database
   - Ensure we know which plan users are on

5. **Subscription Performance Issue**
   - When buying a subscription, it takes too long to process
   - Request logs:
   ```
   Mar 27 13:23:26.55
   GET
   200
   whop-boilerplate.vercel.app
   /pricing
   Looking up profile by user ID: user_2utx6gCKPBkL4RtCvMAuUHZw9S1
   Mar 27 13:23:26.47
   GET
   307
   whop-boilerplate.vercel.app
   /pricing
   Mar 27 13:23:26.17
   GET
   307
   whop-boilerplate.vercel.app
   /pricing
   Mar 27 13:22:44.81
   POST
   200
   whop-boilerplate.vercel.app
   /api/whop/webhooks
   7
   Setting billing cycle end to 1970-01-21T04:54:33.755Z Successfully updated profile for Clerk user user_2utx6gCKPBkL4RtCvMAuUHZw9S1 with Whop data
   Mar 27 13:22:42.71
   POST
   200
   whop-boilerplate.vercel.app
   /api/whop/webhooks
   12
   Looking up profile by user ID: user_2utx6gCKPBkL4RtCvMAuUHZw9S1
   Mar 27 13:22:30.03
   POST
   200
   whop-boilerplate.vercel.app
   /api/whop/create-checkout
   2
   Successfully created Whop checkout for user user_2utx6gCKPBkL4RtCvMAuUHZw9S1: { checkoutUrl: 'https://whop.com/checkout/plan_Fd5UBpraUWKMH/?session=ch_TxxG0SZ7s1CFmU3', sessionId: 'ch_TxxG0SZ7s1CFmU3', planId: 'plan_Fd5UBpraUWKMH' }
   Mar 27 13:22:27.86
   GET
   200
   whop-boilerplate.vercel.app
   /dashboard
   ```

   ### Checkout Process Flow
   
   After checkout is created:
   ```
   Received Whop webhook event
   Raw webhook body: {"data":{"id":"mem_h1MVOnEnSIzrmw","product_id":"prod_f9LX8sLFarMR9","user_id":"user_XTg1QCfhwvToU","plan_id":"plan_Fd5UBpraUWKMH","page_id":"biz_xccbH7e5UNfLvd","created_at":1743081755,"expires_at":null,"renewal_period_start":1743081755,"renewal_period_end":1745673755,"quantity":1,"status":"active","valid":true,"cancel_at_period_end":false,"license_key":"T-9DDDBB-4551CA1E-D266EBW","metadata":{"clerkUserId":"user_2utx6gCKPBkL4RtCvMAuUHZw9S1"},"checkout_id":"4t9yDAZhMTcMWn9tM5-r8PS-9cBj-ylwt-Sz0RvnWkHgu8","affiliate_username":null,"manage_url":"https://whop.com/orders/mem_h1MVOnEnSIzrmw/manage/","company_buyer_id":null,"marketplace":false,"status_reason":"created"},"api_version":"v5","action":"membership.went_valid"}
   ```

   Processing flow:
   ```
   Processing 'membershipWentValid' event
   Event action: membership.went_valid
   Full event data: {
   "data": {
     "id": "mem_h1MVOnEnSIzrmw",
     "product_id": "prod_f9LX8sLFarMR9",
     "user_id": "user_XTg1QCfhwvToU",
     "plan_id": "plan_Fd5UBpraUWKMH",
     "page_id": "biz_xccbH7e5UNfLvd",
     "created_at": 1743081755,
     "expires_at": null,
     "renewal_period_start": 1743081755,
     "renewal_period_end": 1745673755,
     "quantity": 1,
     "status": "active",
     "valid": true,
     "cancel_at_period_end": false,
     "license_key": "T-9DDDBB-4551CA1E-D266EBW",
     "metadata": {
       "clerkUserId": "user_2utx6gCKPBkL4RtCvMAuUHZw9S1"
     },
     "checkout_id": "4t9yDAZhMTcMWn9tM5-r8PS-9cBj-ylwt-Sz0RvnWkHgu8",
     "affiliate_username": null,
     "manage_url": "https://whop.com/orders/mem_h1MVOnEnSIzrmw/manage/",
     "company_buyer_id": null,
     "marketplace": false,
     "status_reason": "created"
   },
   "api_version": "v5",
   "action": "membership.went_valid"
   }
   ```

   Data extraction:
   ```
   Extracting Clerk userId from webhook data
   Data keys: [
   'id', 'product_id',
   'user_id', 'plan_id',
   'page_id', 'created_at',
   'expires_at', 'renewal_period_start',
   'renewal_period_end', 'quantity',
   'status', 'valid',
   'cancel_at_period_end', 'license_key',
   'metadata', 'checkout_id',
   'affiliate_username', 'manage_url',
   'company_buyer_id', 'marketplace',
   'status_reason'
   ]
   Found metadata field: object
   Metadata content: {
   "clerkUserId": "user_2utx6gCKPBkL4RtCvMAuUHZw9S1"
   }
   Found clerkUserId in metadata object: user_2utx6gCKPBkL4RtCvMAuUHZw9S1
   Found Clerk userId user_2utx6gCKPBkL4RtCvMAuUHZw9S1 in metadata, updating membership status to active
   Looking up profile by user ID: user_2utx6gCKPBkL4RtCvMAuUHZw9S1
   ```

   ### Billing Cycle Setup
   
   Setting up billing cycle end:
   ```
   Logs
   7 Total

   Received Whop webhook event
   Raw webhook body: {"data":{"id":"pay_Ki91DXNReIf1Yb","membership_id":"mem_h1MVOnEnSIzrmw","product_id":"prod_f9LX8sLFarMR9","user_id":"user_XTg1QCfhwvToU","plan_id":"plan_Fd5UBpraUWKMH","company_id":"biz_xccbH7e5UNfLvd","line_item_id":null,"created_at":1743081756,"paid_at":1743081759,"refunded_at":null,"last_payment_attempt":null,"next_payment_attempt":null,"status":"paid","subtotal":2.0,"final_amount":2.0,"currency":"usd","refunded_amount":0.0,"payments_failed":1,"checkout_id":"4t9yDAZhMTcMWn9tM5-r8PS-9cBj-ylwt-Sz0RvnWkHgu8","card_brand":"visa","card_last_4":"1990","funding_method":"debit","wallet_type":null,"calculated_statement_descriptor":"WHOP.COM/PAY/P2LTFI","issuer_identification_number":"439654","billing_usage_ids":[],"company_buyer_id":null,"billing_address":{"name":"seb bowkis","line1":"2 governors mews","line2":null,"city":"Bury Saint Edmunds","state":null,"postal_code":"IP33 2GA","country":"GB"},"user_email":"codysrings@gmail.com","user_username":"weirdrewrite","membership_metadata":{"clerkUserId":"user_2utx6gCKPBkL4RtCvMAuUHZw9S1"},"affiliate":null},"api_version":"v5","action":"payment.succeeded"}
   ```

   Payment processing:
   ```
   Processing 'paymentSucceeded' event
   Event action: payment.succeeded
   Full event data: {
     "data": {
       "id": "pay_Ki91DXNReIf1Yb",
       "membership_id": "mem_h1MVOnEnSIzrmw",
       "product_id": "prod_f9LX8sLFarMR9",
       "user_id": "user_XTg1QCfhwvToU",
       "plan_id": "plan_Fd5UBpraUWKMH",
       "company_id": "biz_xccbH7e5UNfLvd",
       "line_item_id": null,
       "created_at": 1743081756,
       "paid_at": 1743081759,
       "refunded_at": null,
       "last_payment_attempt": null,
       "next_payment_attempt": null,
       "status": "paid",
       "subtotal": 2,
       "final_amount": 2,
       "currency": "usd",
       "refunded_amount": 0,
       "payments_failed": 1,
       "checkout_id": "4t9yDAZhMTcMWn9tM5-r8PS-9cBj-ylwt-Sz0RvnWkHgu8",
       "card_brand": "visa",
       "card_last_4": "1990",
       "funding_method": "debit",
       "wallet_type": null,
       "calculated_statement_descriptor": "WHOP.COM/PAY/P2LTFI",
       "issuer_identification_number": "439654",
       "billing_usage_ids": [],
       "company_buyer_id": null,
       "billing_address": {
         "name": "seb bowkis",
         "line1": "2 governors mews",
         "line2": null,
         "city": "Bury Saint Edmunds",
         "state": null,
         "postal_code": "IP33 2GA",
         "country": "GB"
       },
       "user_email": "codysrings@gmail.com",
       "user_username": "weirdrewrite",
       "membership_metadata": {
         "clerkUserId": "user_2utx6gCKPBkL4RtCvMAuUHZw9S1"
       },
       "affiliate": null
     },
     "api_version": "v5",
     "action": "payment.succeeded"
   }
   User ID not found in metadata for payment success event
   Setting billing cycle end to 1970-01-21T04:54:33.755Z
   Successfully updated profile for Clerk user user_2utx6gCKPBkL4RtCvMAuUHZw9S1 with Whop data
   ```

7. **Billing Cycle Date Issues**
   - All credits are set, but billing cycle start date is missing
   - End date is set to: `1970-01-21 04:54:33.755` (in the past)
   - This is for the monthly plan
   - Issue: End date is incorrectly set to a date in 1970

8. **Plan Downgrade Behavior**
   - When downgrading from Pro to Free in the database:
     - Subscription canceled popup appears:
     ```
     Subscription Canceled
     Here's what happens next with your account.

     Transitioned to free plan with 5 credits
     Free plan includes 5 credits every 4 weeks
     Resubscribe anytime to regain full access
     ```
     - Status correctly set to "canceled"
     - Credit usage reset to 5 credits with 0 used
     - Issue: Credit usage should remain unchanged until end of billing cycle

9. **Database Settings Test**
   - Changes made to database:
     - Plan set to Pro
     - Cycle end date changed from `1970-01-21 04:54:33.755` to `2025-03-27 13:35:00` (5 minutes from test time)
     - Renewal date changed from `2025-04-24 13:22:43.789` to match cycle end date
     - Credits kept at 34/1000 used with status as active
     - Billing cycle start remained empty
   
   - Results after time passed:
     - Web page: No immediate changes, still on Pro plan
     - After refresh: Credits changed to 0/1000
     - Database after refresh:
       - Billing cycle end date: `2025-03-27 13:35:00` (unchanged)
       - Status: "active"
       - Credits: 0/1000 used
       - Next credit renewal: `2025-04-24 13:35:27.808`
     - Conclusion: Test was successful

10. **Plan Limits UI Issue**
    - When 1000/1000 credits used, upgrade plan popup correctly appears
    - Issue: Cannot close the popup - it attempts to close but reappears
    - Expected behavior: Popup should close when dismissed
    - Cannot test sidebar nav buttons due to popup issue

11. **Plan Cancellation Test**
    - Setup:
      - Next credit renewal and billing cycle end set to: `2025-04-24 13:35:27.808`
      - Status: active
      - Membership: Pro
      - Credits used: 100/1000
    
    - Expected behavior upon cancellation:
      - Canceled plan popup should appear immediately
      - Database dates should remain unchanged
      - Membership should change to Free
      - Status should remain active
      - Usage should stay at 100/1000
      - Upon renewal date, usage should reset to 0/5 (Free plan)
    
    - Actual behavior:
      - Whop displayed: "Your membership has been canceled"
      - Logs showed multiple 404 errors for webhook endpoints:
      ```
      Raw webhook body: {"data":{"id":"mem_h1MVOnEnSIzrmw",...,"action":"membership.cancel_at_period_end_changed"}
      ```
      - UI still showed 100/1000 credits and Free plan
      - Database still showed: Pro, active, 100/1000
      - After refresh: no change
      - Whop dashboard showed "cancels in 29d 23hrs"
      - After admin cancellation: No change, still showed cancellation pending
      - After admin termination: No change
    
    - Issue: Webhook not properly receiving cancellation events
    - Question: Does webhook only trigger at end of billing cycle?

12. **Required Webhook Setup**
    - Need to set up webhook and action to reset credits to 0/5 at end of billing cycle for refunded users
    - Available webhook events:
    ```
    app_membership_cancel_at_period_end_changed
    app_membership_went_invalid
    app_membership_went_valid
    app_payment_failed
    app_payment_succeeded
    dispute_created
    dispute_updated
    membership_cancel_at_period_end_changed
    membership_experience_claimed
    membership_metadata_updated
    membership_went_invalid
    membership_went_valid
    payment_affiliate_reward_created
    payment_failed
    payment_succeeded
    refund_created
    refund_updated
    ```
    - Likely needed events:
      - `refund_created`
      - `refund_updated`

