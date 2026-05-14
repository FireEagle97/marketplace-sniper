/**
 * Settings page for the Template App dashboard
 * Allows users to configure their account and application settings
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Manage your account preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Settings options will be available here.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
} 