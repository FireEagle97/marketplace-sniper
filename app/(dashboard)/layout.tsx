import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getProfileByUserId } from "@/db/queries/profiles-queries";
import Sidebar from "@/components/sidebar";
import { ReactNode } from "react";

export default async function DashboardGroupLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) return redirect("/login");

  const profile = await getProfileByUserId(userId);
  if (!profile) return redirect("/signup");

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const plan = (user?.publicMetadata?.plan as string) ?? "free";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        profile={profile}
        userEmail={userEmail}
        plan={plan}
        whopMonthlyPlanId={process.env.WHOP_PLAN_ID_MONTHLY ?? ""}
        whopYearlyPlanId={process.env.WHOP_PLAN_ID_YEARLY ?? ""}
      />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
