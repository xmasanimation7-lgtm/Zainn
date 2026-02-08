import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge, PriorityBadge } from "@/components/ui/CustomBadge";
import { Avatar } from "@/components/ui/CustomAvatar";
import { supabase } from "@/integrations/supabase/client";
import { Users, CheckSquare, Clock, TrendingUp, AlertCircle, CalendarOff } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { Link } from "react-router-dom";

interface DashboardStats {
  totalEmployees: number;
  activeTasks: number;
  completedTasks: number;
  pendingLeaveRequests: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  onLeaveToday: number;
  attendanceRate: number;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  assignee?: { full_name: string; avatar_url: string | null };
}

interface RecentAttendance {
  id: string;
  check_in: string;
  status: string;
  user?: { full_name: string; avatar_url: string | null };
}

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  user?: { full_name: string; avatar_url: string | null };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingLeaveRequests: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    onLeaveToday: 0,
    attendanceRate: 0,
  });
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const today = new Date();
        const todayStart = startOfDay(today).toISOString();
        const todayEnd = endOfDay(today).toISOString();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 }).toISOString();
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 }).toISOString();

        // Fetch employee count (active only)
        const { count: employeeCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);

        // Fetch active tasks
        const { count: activeTaskCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .in("status", ["pending", "in_progress"]);

        // Fetch completed tasks (all time)
        const { count: completedTaskCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed");

        // Fetch pending leave requests
        const { count: pendingLeaveCount, data: pendingLeaveData } = await supabase
          .from("leave_requests")
          .select("*, user_id")
          .eq("status", "pending");

        // Enrich pending leaves with user data
        if (pendingLeaveData) {
          const leavesWithUsers = await Promise.all(
            pendingLeaveData.map(async (leave) => {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, avatar_url")
                .eq("id", leave.user_id)
                .single();
              return { ...leave, user: profile || undefined };
            })
          );
          setPendingLeaves(leavesWithUsers);
        }

        // Fetch today's attendance stats
        const { data: todayAttendance } = await supabase
          .from("attendance")
          .select("status")
          .gte("check_in", todayStart)
          .lte("check_in", todayEnd);

        const presentToday = todayAttendance?.filter((a) => a.status === "present").length || 0;
        const lateToday = todayAttendance?.filter((a) => a.status === "late").length || 0;
        const onLeaveToday = todayAttendance?.filter((a) => a.status === "leave").length || 0;
        const totalAttendanceToday = todayAttendance?.length || 0;
        
        // Calculate absent: employees who haven't checked in and aren't on leave
        // Note: leave records ARE included in totalAttendanceToday, so just subtract total
        const absentToday = Math.max(0, (employeeCount || 0) - totalAttendanceToday);

        // Calculate attendance rate for the week
        const { data: weekAttendance } = await supabase
          .from("attendance")
          .select("status")
          .gte("check_in", weekStart)
          .lte("check_in", weekEnd);

        const weekPresent = weekAttendance?.filter((a) => a.status === "present" || a.status === "late").length || 0;
        const weekTotal = (employeeCount || 0) * 5; // Assuming 5 working days
        const attendanceRate = weekTotal > 0 ? Math.round((weekPresent / weekTotal) * 100) : 0;

        // Fetch recent tasks
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("id, title, status, priority, assigned_to")
          .order("created_at", { ascending: false })
          .limit(5);

        if (tasksData) {
          const tasksWithAssignees = await Promise.all(
            tasksData.map(async (task) => {
              if (task.assigned_to) {
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("full_name, avatar_url")
                  .eq("id", task.assigned_to)
                  .single();
                return { ...task, assignee: profile || undefined };
              }
              return task;
            })
          );
          setRecentTasks(tasksWithAssignees);
        }

        // Fetch recent attendance
        const { data: attendanceData } = await supabase
          .from("attendance")
          .select("id, check_in, status, user_id")
          .order("check_in", { ascending: false })
          .limit(5);

        if (attendanceData) {
          const attendanceWithUsers = await Promise.all(
            attendanceData.map(async (record) => {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, avatar_url")
                .eq("id", record.user_id)
                .single();
              return { ...record, user: profile || undefined };
            })
          );
          setRecentAttendance(attendanceWithUsers);
        }

        setStats({
          totalEmployees: employeeCount || 0,
          activeTasks: activeTaskCount || 0,
          completedTasks: completedTaskCount || 0,
          pendingLeaveRequests: pendingLeaveCount || 0,
          presentToday,
          lateToday,
          absentToday,
          onLeaveToday,
          attendanceRate,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Set up real-time subscription for attendance
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => console.log('Channel removal error:', err));
    };
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time overview of your team's performance
          </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Employees"
            value={stats.totalEmployees}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Active Tasks"
            value={stats.activeTasks}
            icon={CheckSquare}
          />
          <StatCard
            title="Completed Tasks"
            value={stats.completedTasks}
            icon={TrendingUp}
            variant="default"
          />
          <StatCard
            title="Attendance Rate"
            value={`${stats.attendanceRate}%`}
            icon={Clock}
            subtitle="This week"
          />
        </div>

        {/* Today's Attendance Summary */}
        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold mb-4">Today's Attendance</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-success/10 p-4 text-center">
              <p className="text-3xl font-bold text-success">{stats.presentToday}</p>
              <p className="text-sm text-success font-medium mt-1">Present</p>
            </div>
            <div className="rounded-xl bg-warning/10 p-4 text-center">
              <p className="text-3xl font-bold text-warning">{stats.lateToday}</p>
              <p className="text-sm text-warning font-medium mt-1">Late</p>
            </div>
            <div className="rounded-xl bg-destructive/10 p-4 text-center">
              <p className="text-3xl font-bold text-destructive">{stats.absentToday}</p>
              <p className="text-sm text-destructive font-medium mt-1">Absent</p>
            </div>
            <div className="rounded-xl bg-info/10 p-4 text-center">
              <p className="text-3xl font-bold text-info">{stats.onLeaveToday}</p>
              <p className="text-sm text-info font-medium mt-1">On Leave</p>
            </div>
          </div>
        </div>

        {/* Pending Leave Requests Alert */}
        {pendingLeaves.length > 0 && (
          <div className="rounded-2xl bg-warning/10 border border-warning/20 p-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="h-5 w-5 text-warning" />
              <h3 className="font-semibold text-warning">Pending Leave Requests ({pendingLeaves.length})</h3>
            </div>
            <div className="space-y-2">
              {pendingLeaves.slice(0, 3).map((leave) => (
                <div key={leave.id} className="flex items-center justify-between bg-card rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" src={leave.user?.avatar_url} fallback={leave.user?.full_name || "U"} />
                    <div>
                      <p className="font-medium text-sm">{leave.user?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {leave.start_date && !isNaN(new Date(leave.start_date).getTime()) && leave.end_date && !isNaN(new Date(leave.end_date).getTime()) ? (
                          <>
                            {format(new Date(leave.start_date), "MMM d")} - {format(new Date(leave.end_date), "MMM d")}
                          </>
                        ) : (
                          "Invalid dates"
                        )}
                      </p>
                    </div>
                  </div>
                  <Link 
                    to="/admin/leave-requests" 
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Tasks */}
          <div className="rounded-2xl bg-card p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Tasks</h2>
              <Link to="/admin/tasks" className="text-sm text-primary font-medium hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-4">
              {recentTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No tasks yet
                </p>
              ) : (
                recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {task.assignee && (
                        <Avatar
                          size="sm"
                          src={task.assignee.avatar_url}
                          fallback={task.assignee.full_name}
                        />
                      )}
                      <div>
                        <p className="font-medium text-sm">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.assignee?.full_name || "Unassigned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Attendance */}
          <div className="rounded-2xl bg-card p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Attendance</h2>
              <Link to="/admin/attendance" className="text-sm text-primary font-medium hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-4">
              {recentAttendance.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No attendance records
                </p>
              ) : (
                recentAttendance.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        size="sm"
                        src={record.user?.avatar_url}
                        fallback={record.user?.full_name || "U"}
                      />
                      <div>
                        <p className="font-medium text-sm">
                          {record.user?.full_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {record.check_in && !isNaN(new Date(record.check_in).getTime())
                            ? format(new Date(record.check_in), "MMM d, h:mm a")
                            : "Invalid date"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
