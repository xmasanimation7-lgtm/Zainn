import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { StatusBadge, PriorityBadge } from "@/components/ui/CustomBadge";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Calendar, Loader2, Paperclip, Image, FileText, File } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  attachment_urls: string[] | null;
}

export default function EmployeeTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const fetchTasks = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      const tasksWithDefaults: Task[] = (data || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        assigned_to: task.assigned_to,
        created_at: task.created_at,
        attachment_urls: null,
      }));
      setTasks(tasksWithDefaults);

      // Check if we should open a specific task from deep-link
      const taskId = searchParams.get("taskId");
      if (taskId && tasksWithDefaults) {
        const targetTask = tasksWithDefaults.find(t => t.id === taskId);
        if (targetTask) {
          setSelectedTask(targetTask);
        }
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user, filter]);

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    setUpdating(true);

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);

      if (error) throw error;

      toast({
        title: "Task updated",
        description: `Status changed to ${newStatus.replace("_", " ")}`,
      });

      setSelectedTask(null);
      fetchTasks();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update task";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getFileIcon = (url: string) => {
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return Image;
    if (url.includes('.pdf')) return FileText;
    return File;
  };

  return (
    <MobileLayout title="My Tasks">
      <div className="space-y-4 animate-fade-in">
        {/* Filter */}
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter tasks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        {/* Tasks List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl bg-card p-8 text-center">
            <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="w-full text-left rounded-xl bg-card p-4 shadow-card hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium flex-1">{task.title}</p>
                  <PriorityBadge priority={task.priority} />
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {task.description.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+\s/g, '')}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={task.status} />
                    {task.attachment_urls && task.attachment_urls.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        {task.attachment_urls.length}
                      </span>
                    )}
                  </div>
                  {task.due_date && !isNaN(new Date(task.due_date).getTime()) && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.due_date), "MMM d")}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Task Detail Sheet */}
        <Sheet open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
            {selectedTask && (
              <>
                <SheetHeader className="text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <PriorityBadge priority={selectedTask.priority} />
                    <StatusBadge status={selectedTask.status} />
                  </div>
                  <SheetTitle className="text-xl">{selectedTask.title}</SheetTitle>
                  <SheetDescription>
                    Created{" "}
                    {selectedTask.created_at && !isNaN(new Date(selectedTask.created_at).getTime())
                      ? format(new Date(selectedTask.created_at), "MMMM d, yyyy")
                      : "date unknown"}
                  </SheetDescription>
                </SheetHeader>

                <ScrollArea className="h-[calc(85vh-180px)] mt-4">
                  <div className="space-y-4 pr-4">
                    {/* Description */}
                    {selectedTask.description && (
                      <div className="rounded-xl bg-muted p-4">
                        <MarkdownRenderer content={selectedTask.description} />
                      </div>
                    )}

                    {/* Due Date */}
                    {selectedTask.due_date && !isNaN(new Date(selectedTask.due_date).getTime()) && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted">
                        <Calendar className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Due Date</p>
                          <p className="font-medium">
                            {format(new Date(selectedTask.due_date), "MMMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Attachments */}
                    {selectedTask.attachment_urls && selectedTask.attachment_urls.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Attachments</h4>
                        <div className="space-y-2">
                          {selectedTask.attachment_urls.map((url, index) => {
                            const Icon = getFileIcon(url);
                            const fileName = url.split('/').pop() || 'attachment';
                            return (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                              >
                                <Icon className="h-5 w-5 text-primary" />
                                <span className="flex-1 text-sm truncate">{fileName}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Update Status */}
                    <div className="pt-4 space-y-3">
                      <p className="font-medium">Update Status</p>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedTask.status !== "pending" && (
                          <Button
                            variant="outline"
                            onClick={() => handleUpdateStatus(selectedTask.id, "pending")}
                            disabled={updating}
                          >
                            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pending"}
                          </Button>
                        )}
                        {selectedTask.status !== "in_progress" && (
                          <Button
                            variant="outline"
                            onClick={() => handleUpdateStatus(selectedTask.id, "in_progress")}
                            disabled={updating}
                          >
                            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : "In Progress"}
                          </Button>
                        )}
                        {selectedTask.status !== "completed" && (
                          <Button
                            className="gradient-primary col-span-2"
                            onClick={() => handleUpdateStatus(selectedTask.id, "completed")}
                            disabled={updating}
                          >
                            {updating ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckSquare className="h-4 w-4 mr-2" />
                            )}
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </MobileLayout>
  );
}
