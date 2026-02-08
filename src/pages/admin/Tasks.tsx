import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatusBadge, PriorityBadge } from "@/components/ui/CustomBadge";
import { Avatar } from "@/components/ui/CustomAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { FileUploader } from "@/components/ui/FileUploader";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreVertical, Pencil, Trash2, Loader2, Calendar, Paperclip, Eye, Image, FileText, File } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  attachment_urls: string[] | null;
  assignee?: { full_name: string; avatar_url: string | null };
}

interface Employee {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface UploadedFile {
  name: string;
  url: string;
  type: string;
}

export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    assigned_to: "",
    due_date: "",
  });

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch assignee details
      const tasksWithAssignees = await Promise.all(
        (data || []).map(async (task: Task) => {
          const taskWithAttachments: Task = {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            assigned_to: task.assigned_to,
            assigned_by: task.assigned_by,
            created_at: task.created_at,
            updated_at: task.updated_at,
            completed_at: task.completed_at,
            attachment_urls: null,
          };
          
          if (task.assigned_to) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, avatar_url")
              .eq("id", task.assigned_to)
              .single();
            if (profile) {
              return { ...taskWithAttachments, assignee: profile };
            }
          }
          return taskWithAttachments;
        })
      );

      setTasks(tasksWithAssignees);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    // First get employee user IDs from user_roles
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "employee");
    
    const employeeIds = (roleData || []).map(r => r.user_id);
    
    if (employeeIds.length === 0) {
      setEmployees([]);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("is_active", true)
      .in("id", employeeIds)
      .order("full_name", { ascending: true });
    setEmployees(data || []);
  };

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, []);

  const handleCreateTask = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }

    setFormLoading(true);

    try {
      const attachmentUrls = attachments.map(a => a.url);
      
      const { data: taskData, error } = await supabase.from("tasks").insert({
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        status: formData.status,
        assigned_to: formData.assigned_to || null,
        assigned_by: user?.id,
        due_date: formData.due_date || null,
        attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : null,
      }).select().single();

      if (error) throw error;

      // Create notification for assigned employee with deep-link
      if (formData.assigned_to && taskData) {
        await supabase.from("notifications").insert({
          user_id: formData.assigned_to,
          title: "New Task Assigned",
          message: `You have been assigned a new task: **${formData.title}**`,
          type: "task",
          related_type: "task",
          related_id: taskData.id,
        });
      }

      toast({
        title: "Task created",
        description: "The task has been created successfully.",
      });

      setIsCreateOpen(false);
      resetForm();
      fetchTasks();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create task";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateTask = async () => {
    if (!selectedTask) return;

    setFormLoading(true);

    try {
      const attachmentUrls = attachments.map(a => a.url);
      
      const updateData: Partial<Task> = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        status: formData.status,
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null,
        attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : null,
      };

      if (formData.status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", selectedTask.id);

      if (error) throw error;

      // Notify assignee of update
      if (formData.assigned_to) {
        await supabase.from("notifications").insert({
          user_id: formData.assigned_to,
          title: "Task Updated",
          message: `Task **${formData.title}** has been updated.`,
          type: "info",
          related_type: "task",
          related_id: selectedTask.id,
        });
      }

      toast({
        title: "Task updated",
        description: "The task has been updated successfully.",
      });

      setIsEditOpen(false);
      setSelectedTask(null);
      resetForm();
      fetchTasks();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update task";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;

      toast({
        title: "Task deleted",
        description: "The task has been deleted.",
      });

      fetchTasks();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete task";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      status: "pending",
      assigned_to: "",
      due_date: "",
    });
    setAttachments([]);
  };

  const openEditDialog = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      assigned_to: task.assigned_to || "",
      due_date: task.due_date?.split("T")[0] || "",
    });
    // Convert attachment URLs back to file objects
    const existingAttachments = (task.attachment_urls || []).map(url => ({
      name: url.split('/').pop() || 'attachment',
      url,
      type: url.includes('.pdf') ? 'application/pdf' : 
            url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image/*' : 'application/octet-stream'
    }));
    setAttachments(existingAttachments);
    setIsEditOpen(true);
  };

  const openDetailSheet = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const getFileIcon = (url: string) => {
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return Image;
    if (url.includes('.pdf')) return FileText;
    return File;
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const TaskFormContent = () => (
    <ScrollArea className="max-h-[60vh]">
      <div className="space-y-4 py-4 pr-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            placeholder="Task title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <RichTextEditor
            value={formData.description}
            onChange={(value) => setFormData({ ...formData, description: value })}
            placeholder="Task details with formatting..."
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            Supports **bold**, *italic*, headers, and lists
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Assign To</Label>
          <Select
            value={formData.assigned_to}
            onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  <div className="flex items-center gap-2">
                    <Avatar size="sm" src={emp.avatar_url} fallback={emp.full_name} />
                    <span>{emp.full_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_date">Due Date</Label>
          <Input
            id="due_date"
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Attachments</Label>
          <FileUploader
            bucket="task-attachments"
            files={attachments}
            onChange={setAttachments}
            maxFiles={5}
            maxSizeMB={10}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
        </div>
      </div>
    </ScrollArea>
  );

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="text-muted-foreground mt-1">
              Manage and assign tasks to your team
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Add a new task with rich content and attachments
                </DialogDescription>
              </DialogHeader>
              <TaskFormContent />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask} disabled={formLoading}>
                  {formLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Task"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-card p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-2xl bg-card p-6 shadow-card transition-all duration-200 hover:shadow-lg cursor-pointer"
                onClick={() => openDetailSheet(task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{task.title}</h3>
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                      {task.attachment_urls && task.attachment_urls.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          <Paperclip className="h-3 w-3" />
                          {task.attachment_urls.length}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                        {task.description.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+\s/g, '')}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {task.assignee && (
                        <div className="flex items-center gap-2">
                          <Avatar
                            size="sm"
                            src={task.assignee.avatar_url}
                            fallback={task.assignee.full_name}
                          />
                          <span>{task.assignee.full_name}</span>
                        </div>
                      )}
                      {task.due_date && !isNaN(new Date(task.due_date).getTime()) && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(task.due_date), "MMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetailSheet(task); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(task); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setSelectedTask(null);
            resetForm();
          }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>Update task details and attachments</DialogDescription>
            </DialogHeader>
            <TaskFormContent />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTask} disabled={formLoading}>
                {formLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Task Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="sm:max-w-lg">
            {selectedTask && (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <PriorityBadge priority={selectedTask.priority} />
                    <StatusBadge status={selectedTask.status} />
                  </div>
                  <SheetTitle className="text-xl">{selectedTask.title}</SheetTitle>
                  <SheetDescription>
                    Created {!isNaN(new Date(selectedTask.created_at).getTime()) ? format(new Date(selectedTask.created_at), "MMM d, yyyy") : "Unknown"}
                  </SheetDescription>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-200px)] mt-6">
                  <div className="space-y-6 pr-4">
                    {/* Description */}
                    {selectedTask.description && (
                      <div>
                        <h4 className="font-medium mb-2">Description</h4>
                        <div className="rounded-lg bg-muted p-4">
                          <MarkdownRenderer content={selectedTask.description} />
                        </div>
                      </div>
                    )}

                    {/* Assignee */}
                    {selectedTask.assignee && (
                      <div>
                        <h4 className="font-medium mb-2">Assigned To</h4>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                          <Avatar
                            src={selectedTask.assignee.avatar_url}
                            fallback={selectedTask.assignee.full_name}
                          />
                          <span>{selectedTask.assignee.full_name}</span>
                        </div>
                      </div>
                    )}

                    {/* Due Date */}
                    {selectedTask.due_date && (
                      <div>
                        <h4 className="font-medium mb-2">Due Date</h4>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                          <Calendar className="h-5 w-5 text-primary" />
                          <span>{!isNaN(new Date(selectedTask.due_date).getTime()) ? format(new Date(selectedTask.due_date), "MMMM d, yyyy") : "Invalid date"}</span>
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
                                className="flex items-center gap-2 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                              >
                                <Icon className="h-5 w-5 text-primary" />
                                <span className="flex-1 text-sm truncate">{fileName}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 flex gap-2">
                      <Button onClick={() => { setIsDetailOpen(false); openEditDialog(selectedTask); }} className="flex-1">
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Task
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
}
