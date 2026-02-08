import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { StatusBadge } from "@/components/ui/CustomBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CheckSquare, Clock, Calendar, History } from "lucide-react";
import { format } from "date-fns";

interface CompletedTask {
  id: string;
  title: string;
  completed_at: string;
  priority: string;
}

interface AttendanceRecord {
  id: string;
  check_in: string;
  check_out: string | null;
  status: string;
  notes: string | null;
}

interface LeaveRecord {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  created_at: string;
}

export default function EmployeeHistory() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leave, setLeave] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Get initial tab from URL params for deep-linking
  const initialTab = searchParams.get("tab") || "tasks";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;

      try {
        // Fetch completed tasks
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("id, title, completed_at, priority")
          .eq("assigned_to", user.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(20);

        setCompletedTasks(tasksData || []);

        // Fetch attendance history
        const { data: attendanceData } = await supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .order("check_in", { ascending: false })
          .limit(30);

        setAttendance(attendanceData || []);

        // Fetch leave requests
        const { data: leaveData } = await supabase
          .from("leave_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        setLeave(leaveData || []);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  // Update tab when URL changes for deep-linking support
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["tasks", "attendance", "leave"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const calculateDuration = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return "—";
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "present":
        return "bg-success/10 text-success";
      case "late":
        return "bg-warning/10 text-warning";
      case "absent":
        return "bg-destructive/10 text-destructive";
      case "leave":
      case "on_leave":
        return "bg-info/10 text-info";
      case "approved":
        return "bg-success/10 text-success";
      case "pending":
        return "bg-warning/10 text-warning";
      case "rejected":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <MobileLayout title="History">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs">Attendance</TabsTrigger>
          <TabsTrigger value="leave" className="text-xs">Leave</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : completedTasks.length === 0 ? (
            <div className="rounded-xl bg-card p-8 text-center">
              <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No completed tasks yet</p>
            </div>
          ) : (
            completedTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl bg-card p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <CheckSquare className="h-3 w-3" />
                      Completed{" "}
                      {task.completed_at && !isNaN(new Date(task.completed_at).getTime())
                        ? format(new Date(task.completed_at), "MMM d, yyyy")
                        : "date unknown"}
                    </p>
                  </div>
                  <StatusBadge status="completed" />
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="attendance" className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : attendance.length === 0 ? (
            <div className="rounded-xl bg-card p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No attendance records yet</p>
            </div>
          ) : (
            attendance.map((record) => (
              <div
                key={record.id}
                className="rounded-xl bg-card p-4 shadow-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">
                    {record.check_in && !isNaN(new Date(record.check_in).getTime())
                      ? format(new Date(record.check_in), "EEEE, MMM d")
                      : "Invalid date"}
                  </p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(record.status)}`}>
                    {record.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      In:{" "}
                      {record.check_in && !isNaN(new Date(record.check_in).getTime())
                        ? format(new Date(record.check_in), "h:mm a")
                        : "Invalid"}
                    </span>
                    {record.check_out && !isNaN(new Date(record.check_out).getTime()) && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Out: {format(new Date(record.check_out), "h:mm a")}
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-foreground">
                    {calculateDuration(record.check_in, record.check_out)}
                  </span>
                </div>
                {record.notes && (
                  <p className="text-sm text-muted-foreground mt-2 italic">{record.notes}</p>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="leave" className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : leave.length === 0 ? (
            <div className="rounded-xl bg-card p-8 text-center">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No leave requests yet</p>
            </div>
          ) : (
            leave.map((request) => (
              <div
                key={request.id}
                className="rounded-xl bg-card p-4 shadow-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">
                    {format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, yyyy")}
                  </p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                </div>
                {request.reason && (
                  <p className="text-sm text-muted-foreground">{request.reason}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Requested {format(new Date(request.created_at), "MMM d, yyyy")}
                </p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </MobileLayout>
  );
}
