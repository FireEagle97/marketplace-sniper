import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { countAlertsByUser } from "@/db/queries/alerts";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (userId) {
    const count = await countAlertsByUser(userId);
    if (count === 0) {
      return redirect("/alerts/new");
    }
  }
  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Welcome to your personal dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>This is where you&apos;ll manage all your content.</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>
              Your recent activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>No recent activity found.</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Stats</CardTitle>
            <CardDescription>
              Your account statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>All systems operational.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
} 