import { getProfileByUserIdAction } from "@/actions/profiles-actions";
import { PaymentStatusAlert } from "@/components/payment/payment-status-alert";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/utilities/providers";
import LayoutWrapper from "@/components/layout-wrapper";
import { ClerkProvider } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { createProfileAction } from "@/actions/profiles-actions";
import { claimPendingProfile } from "@/actions/whop-actions";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Template App",
  description: "A full-stack template for modern web applications."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();

  if (userId) {
    try {
      // First check if the user already has a profile
      const res = await getProfileByUserIdAction(userId);
      
      if (!res.data) {
        // No profile exists for this user, so we might need to create one
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        
        if (email) {
          // Check if there's a pending profile with this email
          console.log(`Checking for pending profile with email ${email} for user ${userId}`);
          
          // Try to claim any pending profile first
          const claimResult = await claimPendingProfile(userId, email);
          
          if (!claimResult.success) {
            // Only create a new profile if we couldn't claim a pending one
            console.log(`No pending profile found, creating new profile for user ${userId} with email ${email}`);
            await createProfileAction({ 
              userId,
              email
            });
          } else {
            console.log(`Successfully claimed pending profile for user ${userId} with email ${email}`);
          }
        } else {
          // No email available, create a basic profile
          console.log(`Creating basic profile for user ${userId} with no email`);
          await createProfileAction({ userId });
        }
      }
    } catch (error) {
      console.error("Error checking/creating user profile:", error);
    }
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Providers
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
            <LayoutWrapper>
              {userId && <PaymentStatusAlert />}
              {children}
            </LayoutWrapper>
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
