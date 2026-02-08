import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Avatar } from "@/components/ui/CustomAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Briefcase, PieChart, Calendar } from "lucide-react";
import { format } from "date-fns";

interface EmployeeData {
  id: string;
  full_name: string;
  department: string | null;
  title: string | null;
  avatar_url: string | null;
  created_at: string;
}

export default function AdminEmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, pending: 0 });

  const fetchEmployeeData = useCallback(async (employeeId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", employeeId)
        .single();

      if (profileError) throw profileError;
      setEmployee(profileData);

      // Fetch task statistics
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("id, status")
        .eq("assigned_to", employeeId);

      if (!tasksError && tasksData) {
        const stats = {
          total: tasksData.length,
          completed: tasksData.filter(t => t.status === "completed").length,
          pending: tasksData.filter(t => t.status === "pending").length,
        };
        setTaskStats(stats);
      }
    } catch (error) {
      console.error("Error fetching employee data:", error);
      toast({
        title: "Error",
        description: "Failed to load employee profile",
        variant: "destructive",
      });
      navigate("/admin/employees");
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    if (!id) {
      navigate("/admin/employees");
      return;
    }
    void fetchEmployeeData(id);
  }, [id, navigate, fetchEmployeeData]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!employee) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Employee not found</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/employees")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Employee Profile</h1>
        </div>

        {/* Main Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <Avatar
                  src={employee.avatar_url}
                  alt={employee.full_name}
                  className="h-32 w-32"
                />
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{employee.full_name}</h2>
                  <p className="text-muted-foreground">{employee.title || "Employee"}</p>
                </div>
              </div>

              {/* Info Section */}
              <div className="flex-1 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Department */}
                  {employee.department && (
                    <div className="flex items-start gap-3">
                      <Briefcase className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Department</p>
                        <p className="text-sm">{employee.department}</p>
                      </div>
                    </div>
                  )}

                  {/* Joined */}
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Joined</p>
                      <p className="text-sm">{format(new Date(employee.created_at), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Statistics */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-500" />
                {taskStats.total}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{taskStats.completed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{taskStats.pending}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
