import { MobileLayout } from "@/components/layout/MobileLayout";
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
import { useToast } from "@/hooks/use-toast";
import { Moon, Sun, Bell, Volume2, LogOut, ChevronRight } from "lucide-react";

export default function EmployeeSettings() {
  const { settings, updateSettings } = useSettings();
  const { signOut } = useAuth();
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
    });
  };

  const handleNotificationsChange = async (enabled: boolean) => {
    await updateSettings({ notifications_enabled: enabled });
  };

  const handleSoundChange = async (enabled: boolean) => {
    await updateSettings({ sound_enabled: enabled });
  };

  return (
    <MobileLayout title="Settings">
      <div className="space-y-6 animate-fade-in">
        {/* Theme */}
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.theme === "dark" ? (
                <Moon className="h-5 w-5 text-primary" />
              ) : (
                <Sun className="h-5 w-5 text-primary" />
              )}
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  {settings.theme === "dark" ? "Dark mode" : "Light mode"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted">
              <Button
                variant={settings.theme === "light" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleThemeChange("light")}
                className="h-8 px-3"
              >
                <Sun className="h-4 w-4" />
              </Button>
              <Button
                variant={settings.theme === "dark" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleThemeChange("dark")}
                className="h-8 px-3"
              >
                <Moon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Layout Density</p>
              <p className="text-sm text-muted-foreground">
                Adjust spacing
              </p>
            </div>
            <Select
              value={settings.layout_density}
              onValueChange={(value) =>
                handleLayoutChange(value as "compact" | "comfortable" | "spacious")
              }
            >
              <SelectTrigger className="w-[130px]">
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
        <div className="rounded-2xl bg-card p-4 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Push notifications
                </p>
              </div>
            </div>
            <Switch
              checked={settings.notifications_enabled}
              onCheckedChange={handleNotificationsChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Sound</p>
                <p className="text-sm text-muted-foreground">
                  Notification sounds
                </p>
              </div>
            </div>
            <Switch
              checked={settings.sound_enabled}
              onCheckedChange={handleSoundChange}
            />
          </div>
        </div>

        {/* Logout */}
        <Button
          variant="destructive"
          onClick={signOut}
          className="w-full"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </MobileLayout>
  );
}
