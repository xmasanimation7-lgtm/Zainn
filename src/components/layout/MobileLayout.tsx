import { ReactNode } from "react";
import { MobileNav } from "./MobileNav";
import { useAuth } from "@/lib/auth";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/CustomAvatar";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showHeader?: boolean;
}

export function MobileLayout({ children, title, showHeader = true }: MobileLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {showHeader && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Link to="/employee/profile">
                <Avatar size="md" fallback={user?.email || "E"} />
              </Link>
              <div>
                <p className="text-xs text-muted-foreground">Welcome back</p>
                <p className="font-semibold">{title || "Dashboard"}</p>
              </div>
            </div>
            <Link
              to="/employee/notifications"
              className="relative p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            </Link>
          </div>
        </header>
      )}
      <main className="flex-1 px-4 py-4">{children}</main>
      <MobileNav />
    </div>
  );
}
