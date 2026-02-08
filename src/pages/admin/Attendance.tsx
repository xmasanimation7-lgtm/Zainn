import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatusBadge } from "@/components/ui/CustomBadge";
import { Avatar } from "@/components/ui/CustomAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, Clock, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

interface AttendanceRecord {
  id: string;
  user_id: string;
  check_in: string;
  check_out: string | null;
  status: string;
  notes: string | null;
  user?: { full_name: string; avatar_url: string | null; department: string | null };
}

export default function Attendance() {
  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [monthFilter, setMonthFilter] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [viewMode, setViewMode] = useState<"day" | "month">("day");

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("attendance")
        .select("*")
        .order("check_in", { ascending: false });

      if (viewMode === "day" && dateFilter) {
        const startOfDay = `${dateFilter}T00:00:00`;
        const endOfDay = `${dateFilter}T23:59:59`;
        query = query.gte("check_in", startOfDay).lte("check_in", endOfDay);
      } else if (viewMode === "month" && monthFilter) {
        const [year, month] = monthFilter.split("-").map(Number);
        const startDate = startOfMonth(new Date(year, month - 1));
        const endDate = endOfMonth(new Date(year, month - 1));
        query = query
          .gte("check_in", startDate.toISOString())
          .lte("check_in", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user details
      const recordsWithUsers = await Promise.all(
        (data || []).map(async (record) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url, department")
            .eq("id", record.user_id)
            .single();
          return { ...record, user: profile || undefined };
        })
      );

      setRecords(recordsWithUsers);
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast({
        title: "Error",
        description: "Failed to load attendance records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter, monthFilter, viewMode]);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("attendance-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => {
          fetchAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => console.log('Channel removal error:', err));
    };
  }, [dateFilter, monthFilter, viewMode]);

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.user?.full_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      record.user?.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const calculateDuration = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return "In progress";
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleExportToExcel = async () => {
    setExporting(true);
    try {
      // Create CSV content
      const headers = ["Employee", "Department", "Date", "Check In", "Check Out", "Duration", "Status"];
      const rows = filteredRecords.map((record) => {
        const checkInDate = new Date(record.check_in);
        const checkOutDate = record.check_out ? new Date(record.check_out) : null;
        const validCheckIn = !isNaN(checkInDate.getTime());
        const validCheckOut = checkOutDate && !isNaN(checkOutDate.getTime());
        
        return [
          record.user?.full_name || "Unknown",
          record.user?.department || "N/A",
          validCheckIn ? format(checkInDate, "yyyy-MM-dd") : "Invalid",
          validCheckIn ? format(checkInDate, "h:mm a") : "Invalid",
          validCheckOut ? format(checkOutDate, "h:mm a") : "-",
          calculateDuration(record.check_in, record.check_out),
          record.status,
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `attendance_${viewMode === "day" ? dateFilter : monthFilter}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: "Attendance data has been exported to CSV.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export attendance data",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
            <p className="text-muted-foreground mt-1">
              Track team attendance and working hours
            </p>
          </div>
          <Button
            onClick={handleExportToExcel}
            disabled={exporting || filteredRecords.length === 0}
            variant="outline"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export to CSV
              </>
            )}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={viewMode} onValueChange={(v: "day" | "month") => setViewMode(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily View</SelectItem>
              <SelectItem value="month">Monthly View</SelectItem>
            </SelectContent>
          </Select>

          {viewMode === "day" ? (
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[180px]"
            />
          ) : (
            <Input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-[180px]"
            />
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="late">Late</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="leave">On Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-success/10 p-4">
            <p className="text-sm text-success font-medium">Present</p>
            <p className="text-2xl font-bold text-success">
              {filteredRecords.filter((r) => r.status === "present").length}
            </p>
          </div>
          <div className="rounded-xl bg-warning/10 p-4">
            <p className="text-sm text-warning font-medium">Late</p>
            <p className="text-2xl font-bold text-warning">
              {filteredRecords.filter((r) => r.status === "late").length}
            </p>
          </div>
          <div className="rounded-xl bg-destructive/10 p-4">
            <p className="text-sm text-destructive font-medium">Absent</p>
            <p className="text-2xl font-bold text-destructive">
              {filteredRecords.filter((r) => r.status === "absent").length}
            </p>
          </div>
          <div className="rounded-xl bg-info/10 p-4">
            <p className="text-sm text-info font-medium">On Leave</p>
            <p className="text-2xl font-bold text-info">
              {filteredRecords.filter((r) => r.status === "leave").length}
            </p>
          </div>
        </div>

        {/* Attendance List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-card p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No attendance records found</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Employee</th>
                    {viewMode === "month" && (
                      <th className="text-left p-4 font-medium">Date</th>
                    )}
                    <th className="text-left p-4 font-medium">Check In</th>
                    <th className="text-left p-4 font-medium">Check Out</th>
                    <th className="text-left p-4 font-medium">Duration</th>
                    <th className="text-left p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            size="md"
                            src={record.user?.avatar_url}
                            fallback={record.user?.full_name || "U"}
                          />
                          <div>
                            <p className="font-medium">
                              {record.user?.full_name || "Unknown"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {record.user?.department || "No department"}
                            </p>
                          </div>
                        </div>
                      </td>
                      {viewMode === "month" && (
                        <td className="p-4 text-sm">
                          {record.check_in && !isNaN(new Date(record.check_in).getTime())
                            ? format(new Date(record.check_in), "MMM d, yyyy")
                            : "Invalid"}
                        </td>
                      )}
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {record.check_in && !isNaN(new Date(record.check_in).getTime())
                            ? format(new Date(record.check_in), "h:mm a")
                            : "Invalid"}
                        </div>
                      </td>
                      <td className="p-4">
                        {record.check_out && !isNaN(new Date(record.check_out).getTime()) ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(record.check_out), "h:mm a")}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-sm">
                        {calculateDuration(record.check_in, record.check_out)}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={record.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
