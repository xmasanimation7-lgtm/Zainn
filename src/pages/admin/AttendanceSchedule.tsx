import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, Save, Loader2 } from "lucide-react";

interface ScheduleDay {
  id: string;
  day_of_week: number;
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
  is_working_day: boolean;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AttendanceSchedule() {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from("attendance_schedule")
        .select("*")
        .order("day_of_week", { ascending: true });

      if (error) throw error;
      setSchedule(data || []);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast({
        title: "Error",
        description: "Failed to load attendance schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const handleScheduleChange = (dayIndex: number, field: keyof ScheduleDay, value: string | boolean) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.day_of_week === dayIndex ? { ...day, [field]: value } : day
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      for (const day of schedule) {
        const { error } = await supabase
          .from("attendance_schedule")
          .update({
            check_in_start: day.check_in_start,
            check_in_end: day.check_in_end,
            check_out_start: day.check_out_start,
            check_out_end: day.check_out_end,
            is_working_day: day.is_working_day,
          })
          .eq("id", day.id);

        if (error) throw error;
      }

      toast({
        title: "Schedule saved",
        description: "Attendance schedule has been updated successfully.",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to save schedule",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Attendance Schedule</h1>
            <p className="text-muted-foreground mt-1">
              Set expected check-in and check-out times for each day
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gradient-primary">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Schedule
              </>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="rounded-xl bg-card p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-6 w-24 bg-muted rounded" />
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div className="h-10 bg-muted rounded" />
                    <div className="h-10 bg-muted rounded" />
                    <div className="h-10 bg-muted rounded" />
                    <div className="h-10 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {schedule.map((day) => (
              <div
                key={day.id}
                className={`rounded-xl bg-card p-6 shadow-card transition-all ${
                  !day.is_working_day ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
                  {/* Day Name & Toggle */}
                  <div className="flex items-center justify-between lg:justify-start lg:w-40 gap-4">
                    <span className="font-semibold text-lg">
                      {DAY_NAMES[day.day_of_week]}
                    </span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={day.is_working_day}
                        onCheckedChange={(checked) =>
                          handleScheduleChange(day.day_of_week, "is_working_day", checked)
                        }
                      />
                      <span className="text-sm text-muted-foreground">
                        {day.is_working_day ? "Working" : "Off"}
                      </span>
                    </div>
                  </div>

                  {/* Time Inputs */}
                  <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Check-in Start
                      </Label>
                      <Input
                        type="time"
                        value={day.check_in_start}
                        onChange={(e) =>
                          handleScheduleChange(day.day_of_week, "check_in_start", e.target.value)
                        }
                        disabled={!day.is_working_day}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Check-in End
                      </Label>
                      <Input
                        type="time"
                        value={day.check_in_end}
                        onChange={(e) =>
                          handleScheduleChange(day.day_of_week, "check_in_end", e.target.value)
                        }
                        disabled={!day.is_working_day}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Check-out Start
                      </Label>
                      <Input
                        type="time"
                        value={day.check_out_start}
                        onChange={(e) =>
                          handleScheduleChange(day.day_of_week, "check_out_start", e.target.value)
                        }
                        disabled={!day.is_working_day}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Check-out End
                      </Label>
                      <Input
                        type="time"
                        value={day.check_out_end}
                        onChange={(e) =>
                          handleScheduleChange(day.day_of_week, "check_out_end", e.target.value)
                        }
                        disabled={!day.is_working_day}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Card */}
        <div className="rounded-xl bg-info/10 border border-info/20 p-4">
          <h3 className="font-semibold text-info mb-2">How Attendance Status Works</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Present:</strong> Employee checks in within the allowed time range</li>
            <li>• <strong>Late:</strong> Employee checks in after the check-in end time</li>
            <li>• <strong>Absent:</strong> No check-in recorded for a working day</li>
            <li>• <strong>On Leave:</strong> Approved leave for the day</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
