import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { resolveUserAccess } from "@/lib/auth/rbac";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();

  // Not signed in → send to sign-in. Not in an org → send to chat.
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/org-selection");

  const userAccess = await resolveUserAccess(userId, orgId);

  // Step 4: Role-guard admin pages
  // Check resolveUserAccess().role === 'admin'
  if (userAccess.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          <div className="absolute -inset-4 bg-red-500/10 rounded-full blur-2xl" />
          <ShieldAlert className="h-16 w-16 text-red-500 relative" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Admin Access Required
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            This area is restricted to organization administrators. Contact your admin to request elevated access.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Button asChild variant="outline" className="border-border hover:bg-muted/50">
            <Link href="/briefing">Return to Dashboard</Link>
          </Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <a href="mailto:?subject=Admin%20Access%20Request&body=Hi%2C%20I%20would%20like%20to%20request%20admin%20access%20to%20the%20Athene%20AI%20administration%20area.">
              Request Admin Access
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
