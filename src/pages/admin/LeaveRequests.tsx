import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Avatar } from "@/components/ui/CustomAvatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2, Calendar, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface LeaveRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  user?: { full_name: string; avatar_url: string | null; department: string | null };
}

export default function LeaveRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchLeaveRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with user data
      const requestsWithUsers = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url, department")
            .eq("id", request.user_id)
            .single();
          return { ...request, user: profile || undefined };
        })
      );

      setRequests(requestsWithUsers);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      toast({
        title: "Error",
        description: "Failed to load leave requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();

    // Real-time subscription
    const channel = supabase
      .channel('leave-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchLeaveRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => console.log('Channel removal error:', err));
    };
  }, []);

  const handleApprove = async (request: LeaveRequest) => {
    if (!user) return;
    setProcessingId(request.id);

    try {
      // Update leave request status
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // Create attendance records for leave days
      const startDate = new Date(request.start_date);
      const endDate = new Date(request.end_date);
      const leaveAttendanceRecords = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        leaveAttendanceRecords.push({
          user_id: request.user_id,
          check_in: new Date(d).toISOString(),
          status: "leave",
          notes: `Approved leave: ${request.reason || "No reason provided"}`,
        });
      }

      if (leaveAttendanceRecords.length > 0) {
        await supabase.from("attendance").insert(leaveAttendanceRecords);
      }

      // Send notification to employee
      await supabase.from("notifications").insert({
        user_id: request.user_id,
        title: "Leave Request Approved",
        message: `Your leave request from ${format(startDate, "MMM d")} to ${format(endDate, "MMM d")} has been approved.`,
        type: "success",
        related_type: "leave",
        related_id: request.id,
      });

      toast({
        title: "Leave approved",
        description: `Leave request for ${request.user?.full_name} has been approved.`,
      });

      fetchLeaveRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve leave request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (request: LeaveRequest) => {
    if (!user) return;
    setProcessingId(request.id);

    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "declined",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      // Send notification to employee
      await supabase.from("notifications").insert({
        user_id: request.user_id,
        title: "Leave Request Declined",
        message: `Your leave request from ${format(new Date(request.start_date), "MMM d")} to ${format(new Date(request.end_date), "MMM d")} has been declined.`,
        type: "error",
        related_type: "leave",
        related_id: request.id,
      });

      toast({
        title: "Leave declined",
        description: `Leave request for ${request.user?.full_name} has been declined.`,
      });

      fetchLeaveRequests();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to decline leave request";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const declinedRequests = requests.filter((r) => r.status === "declined");

  const renderRequestCard = (request: LeaveRequest, showActions: boolean = false) => (
    <div
      key={request.id}
      className="rounded-xl bg-card p-4 shadow-card border border-border"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar
            size="md"
            src={request.user?.avatar_url}
            fallback={request.user?.full_name || "U"}
          />
          <div>
            <p className="font-semibold">{request.user?.full_name || "Unknown"}</p>
            <p className="text-sm text-muted-foreground">
              {request.user?.department || "No department"}
            </p>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => handleDecline(request)}
              disabled={processingId === request.id}
            >
              {processingId === request.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              className="bg-success hover:bg-success/90 text-success-foreground"
              onClick={() => handleApprove(request)}
              disabled={processingId === request.id}
            >
              {processingId === request.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {!showActions && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              request.status === "approved"
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {format(new Date(request.start_date), "MMM d, yyyy")} -{" "}
            {format(new Date(request.end_date), "MMM d, yyyy")}
          </span>
        </div>
      </div>

      {request.reason && (
        <p className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          {request.reason}
        </p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Requested on {format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}
      </p>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">
            Manage employee leave requests
          </p>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingRequests.length > 0 && (
                <span className="ml-2 h-5 w-5 rounded-full bg-warning text-warning-foreground text-xs flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="declined">Declined</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-1/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <CalendarOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending leave requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => renderRequestCard(request, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-6">
            {approvedRequests.length === 0 ? (
              <div className="text-center py-12">
                <Check className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No approved leave requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {approvedRequests.map((request) => renderRequestCard(request))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="declined" className="mt-6">
            {declinedRequests.length === 0 ? (
              <div className="text-center py-12">
                <X className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No declined leave requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {declinedRequests.map((request) => renderRequestCard(request))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
