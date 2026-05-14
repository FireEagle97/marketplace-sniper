/**
 * Members page for the Template App dashboard
 * Displays and manages team members and permissions
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MembersPage() {
  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold mb-8">Members</h1>
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage your team and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>You are the only member of this team.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
} 