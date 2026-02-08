import { useEffect, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge, PriorityBadge } from "@/components/ui/CustomBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Clock, Calendar, MapPin, Loader2, CalendarOff, Info } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}

interface AttendanceRecord {
  id: string;
  check_in: string;
  check_out: string | null;
  status: string;
}

interface ScheduleDay {
  day_of_week: number;
  check_in_start: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
  is_working_day: boolean;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<ScheduleDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    start_date: "",
    end_date: "",
    reason: "",
  });

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch pending tasks
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date")
        .eq("assigned_to", user.id)
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(3);

      setTasks(tasksData || []);

      // Fetch today's attendance
      const today = new Date().toISOString().split("T")[0];
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .gte("check_in", `${today}T00:00:00`)
        .lte("check_in", `${today}T23:59:59`)
        .single();

      setTodayAttendance(attendanceData);

      // Fetch today's schedule
      const dayOfWeek = new Date().getDay();
      const { data: scheduleData } = await supabase
        .from("attendance_schedule")
        .select("*")
        .eq("day_of_week", dayOfWeek)
        .single();

      setTodaySchedule(scheduleData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const determineStatus = (checkInTime: Date): string => {
    if (!todaySchedule) return "present";
    
    const checkInEndParts = todaySchedule.check_in_end.split(":");
    const checkInEndMinutes = parseInt(checkInEndParts[0]) * 60 + parseInt(checkInEndParts[1]);
    const currentMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();

    return currentMinutes > checkInEndMinutes ? "late" : "present";
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setCheckingIn(true);

    try {
      // Get current location
      let latitude = 0;
      let longitude = 0;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;

          // Log GPS
          await supabase.from("gps_logs").insert({
            user_id: user.id,
            latitude,
            longitude,
            accuracy: position.coords.accuracy,
          });
        } catch (geoError) {
          console.log("Geolocation not available");
        }
      }

      // Determine status based on schedule
      const now = new Date();
      const status = determineStatus(now);

      // Check in
      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        status,
      });

      if (error) throw error;

      toast({
        title: status === "late" ? "Checked in (Late)" : "Checked in!",
        description: `You checked in at ${format(now, "h:mm a")}${status === "late" ? " - marked as late" : ""}`,
        variant: status === "late" ? "destructive" : "default",
      });

      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to check in";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !todayAttendance) return;
    setCheckingIn(true);

    try {
      const { error } = await supabase
        .from("attendance")
        .update({ check_out: new Date().toISOString() })
        .eq("id", todayAttendance.id);

      if (error) throw error;

      toast({
        title: "Checked out!",
        description: `You checked out at ${format(new Date(), "h:mm a")}`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to check out",
        variant: "destructive",
      });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSubmitLeave = async () => {
    if (!user || !leaveForm.start_date || !leaveForm.end_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLeaveLoading(true);

    try {
      const { data: leaveData, error } = await supabase.from("leave_requests").insert({
        user_id: user.id,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason || null,
      }).select().single();

      if (error) throw error;

      // Notify all admins about the leave request
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles && adminRoles.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        const adminNotifications = adminRoles.map((admin) => ({
          user_id: admin.user_id,
          title: "New Leave Request",
          message: `**${profile?.full_name || "Employee"}** has requested leave from ${leaveForm.start_date} to ${leaveForm.end_date}.${leaveForm.reason ? ` Reason: ${leaveForm.reason}` : ""}`,
          type: "warning",
          related_type: "leave",
          related_id: leaveData?.id || null,
        }));

        await supabase.from("notifications").insert(adminNotifications);
      }

      toast({
        title: "Leave request submitted",
        description: "Your request has been sent to admin for approval.",
      });

      setIsLeaveDialogOpen(false);
      setLeaveForm({ start_date: "", end_date: "", reason: "" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit leave request";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLeaveLoading(false);
    }
  };

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;

  return (
    <MobileLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Schedule Info */}
        {todaySchedule && todaySchedule.is_working_day && (
          <div className="rounded-xl bg-info/10 border border-info/20 p-3">
            <div className="flex items-center gap-2 text-info text-sm">
              <Info className="h-4 w-4" />
              <span>
                Today: Check-in {todaySchedule.check_in_start.slice(0, 5)} - {todaySchedule.check_in_end.slice(0, 5)}
                {" | "}
                Check-out {todaySchedule.check_out_start.slice(0, 5)} - {todaySchedule.check_out_end.slice(0, 5)}
              </span>
            </div>
          </div>
        )}

        {/* Check In/Out Card */}
        <div className="rounded-2xl gradient-hero p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/70 text-sm">
                {format(new Date(), "EEEE, MMMM d")}
              </p>
              <p className="text-2xl font-bold">{format(new Date(), "h:mm a")}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
          </div>

          {todaySchedule && !todaySchedule.is_working_day ? (
            <div className="text-center py-4">
              <CalendarOff className="h-8 w-8 mx-auto mb-2 opacity-70" />
              <p className="text-white/80">Today is not a working day</p>
            </div>
          ) : todayAttendance ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70">Checked in at</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {todayAttendance.check_in && !isNaN(new Date(todayAttendance.check_in).getTime())
                      ? format(new Date(todayAttendance.check_in), "h:mm a")
                      : "Invalid"}
                  </span>
                  {todayAttendance.status === "late" && (
                    <span className="text-xs bg-warning/20 px-2 py-0.5 rounded">Late</span>
                  )}
                </div>
              </div>
              {todayAttendance.check_out && !isNaN(new Date(todayAttendance.check_out).getTime()) ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Checked out at</span>
                  <span className="font-medium">
                    {format(new Date(todayAttendance.check_out), "h:mm a")}
                  </span>
                </div>
              ) : (
                <Button
                  onClick={handleCheckOut}
                  disabled={checkingIn}
                  className="w-full bg-white/20 hover:bg-white/30 border-0"
                >
                  {checkingIn ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <MapPin className="h-4 w-4 mr-2" />
                  )}
                  Check Out
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full bg-white/20 hover:bg-white/30 border-0"
              >
                {checkingIn ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <MapPin className="h-4 w-4 mr-2" />
                )}
                Check In
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsLeaveDialogOpen(true)}
                className="w-full bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                <CalendarOff className="h-4 w-4 mr-2" />
                Request Leave
              </Button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="Pending"
            value={pendingCount}
            icon={CheckSquare}
            variant="default"
          />
          <StatCard
            title="In Progress"
            value={inProgressCount}
            icon={Clock}
            variant="primary"
          />
        </div>

        {/* Recent Tasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent Tasks</h2>
            <Link
              to="/employee/tasks"
              className="text-sm text-primary font-medium"
            >
              View All
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl bg-card p-6 text-center">
              <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No pending tasks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/employee/tasks`}
                  className="block rounded-xl bg-card p-4 shadow-card hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      {task.due_date && !isNaN(new Date(task.due_date).getTime()) && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due {format(new Date(task.due_date), "MMM d")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leave Request Dialog */}
      <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              Submit a leave request for approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                min={leaveForm.start_date || new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Brief reason for leave..."
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLeaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitLeave} disabled={leaveLoading}>
              {leaveLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
