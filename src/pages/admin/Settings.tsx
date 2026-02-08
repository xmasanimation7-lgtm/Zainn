import { AdminLayout } from "@/components/layout/AdminLayout";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar } from "@/components/ui/CustomAvatar";
import { useToast } from "@/hooks/use-toast";
import { Moon, Sun, Bell, Volume2, Layout, User, Shield, LogOut } from "lucide-react";

export default function AdminSettings() {
  const { settings, updateSettings } = useSettings();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const handleThemeChange = async (theme: "light" | "dark") => {
    await updateSettings({ theme });
    toast({
      title: "Theme updated",
      description: `Switched to ${theme} mode`,
    });
  };

  const handleLayoutChange = async (density: "compact" | "comfortable" | "spacious") => {
    await updateSettings({ layout_density: density });
    toast({
      title: "Layout updated",
      description: `Layout density set to ${density}`,
    });
  };

  const handleNotificationsChange = async (enabled: boolean) => {
    await updateSettings({ notifications_enabled: enabled });
    toast({
      title: enabled ? "Notifications enabled" : "Notifications disabled",
    });
  };

  const handleSoundChange = async (enabled: boolean) => {
    await updateSettings({ sound_enabled: enabled });
    toast({
      title: enabled ? "Sound enabled" : "Sound disabled",
    });
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your preferences and account settings
          </p>
        </div>

        {/* Account */}
        <div className="rounded-2xl bg-card p-6 shadow-card space-y-6">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Account</h2>
          </div>
          <Separator />
          <div className="flex items-center gap-4">
            <Avatar size="xl" fallback={user?.email || "A"} />
            <div>
              <p className="font-semibold">Admin Account</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-2xl bg-card p-6 shadow-card space-y-6">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Appearance</h2>
          </div>
          <Separator />

          {/* Theme */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose between light and dark mode
              </p>
            </div>
            <div className="flex items-center gap-2 p-1 rounded-xl bg-muted">
              <Button
                variant={settings.theme === "light" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleThemeChange("light")}
                className="gap-2"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={settings.theme === "dark" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleThemeChange("dark")}
                className="gap-2"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
            </div>
          </div>

          {/* Layout Density */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Layout Density</Label>
              <p className="text-sm text-muted-foreground">
                Adjust the spacing of interface elements
              </p>
            </div>
            <Select
              value={settings.layout_density}
              onValueChange={(value) =>
                handleLayoutChange(value as "compact" | "comfortable" | "spacious")
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="spacious">Spacious</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl bg-card p-6 shadow-card space-y-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications for important updates
              </p>
            </div>
            <Switch
              checked={settings.notifications_enabled}
              onCheckedChange={handleNotificationsChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Sound</Label>
              <p className="text-sm text-muted-foreground">
                Play sound for notifications
              </p>
            </div>
            <Switch
              checked={settings.sound_enabled}
              onCheckedChange={handleSoundChange}
            />
          </div>
        </div>

        {/* Security */}
        <div className="rounded-2xl bg-card p-6 shadow-card space-y-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Security</h2>
          </div>
          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Sign Out</Label>
              <p className="text-sm text-muted-foreground">
                Sign out from your account
              </p>
            </div>
            <Button variant="destructive" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
