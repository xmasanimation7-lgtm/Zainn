import { useEffect, useState, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Bell, Loader2, Send, Paperclip, X, FileText } from "lucide-react";
import { format } from "date-fns";

interface Employee {
  id: string;
  full_name: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  type: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  user_id: string;
  attachment_url: string | null;
  user?: { full_name: string };
}

export default function AdminNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [history, setHistory] = useState<Notification[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "info",
  });

  useEffect(() => {
    const fetchData = async () => {
      // Fetch employees (only those with employee role)
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "employee");
      
      const employeeIds = (roleData || []).map(r => r.user_id);
      
      let empData: Employee[] = [];
      if (employeeIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("is_active", true)
          .in("id", employeeIds);
        empData = data || [];
      }
      setEmployees(empData);

      // Fetch templates
      const { data: templateData } = await supabase
        .from("notification_templates")
        .select("*")
        .order("name", { ascending: true });
      setTemplates(templateData || []);

      // Fetch notification history
      const { data: historyData } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (historyData) {
        const historyWithUsers = await Promise.all(
          historyData.map(async (notif) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", notif.user_id)
              .single();
            return { ...notif, user: profile || undefined };
          })
        );
        setHistory(historyWithUsers);
      }
    };
    fetchData();
  }, []);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedEmployees(employees.map((e) => e.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
    setSelectAll(false);
  };

  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.message.substring(start, end);
    const newText =
      formData.message.substring(0, start) +
      prefix +
      selectedText +
      suffix +
      formData.message.substring(end);

    setFormData({ ...formData, message: newText });
    
    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFormData({
        title: template.title,
        message: template.message,
        type: template.type,
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB",
          variant: "destructive",
        });
        return;
      }
      setAttachmentFile(file);
    }
  };

  const handleSendNotification = async () => {
    if (selectedEmployees.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one recipient",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title || !formData.message) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setFormLoading(true);

    try {
      let attachmentUrl = null;

      // Upload attachment if present
      if (attachmentFile) {
        setUploadingAttachment(true);
        const fileName = `${Date.now()}-${attachmentFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(fileName, attachmentFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("attachments")
          .getPublicUrl(fileName);

        attachmentUrl = urlData.publicUrl;
        setUploadingAttachment(false);
      }

      // Create notifications for all selected employees
      const notifications = selectedEmployees.map((empId) => ({
        user_id: empId,
        title: formData.title,
        message: formData.message,
        type: formData.type,
        attachment_url: attachmentUrl,
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;

      toast({
        title: "Notifications sent",
        description: `Sent to ${selectedEmployees.length} employee(s) successfully.`,
      });

      // Reset form
      setIsCreateOpen(false);
      setFormData({ title: "", message: "", type: "info" });
      setSelectedEmployees([]);
      setSelectAll(false);
      setAttachmentFile(null);

      // Refresh history
      const { data: historyData } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (historyData) {
        const historyWithUsers = await Promise.all(
          historyData.map(async (notif) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", notif.user_id)
              .single();
            return { ...notif, user: profile || undefined };
          })
        );
        setHistory(historyWithUsers);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send notifications",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
      setUploadingAttachment(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-success/10 text-success";
      case "warning":
        return "bg-warning/10 text-warning";
      case "error":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-info/10 text-info";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              Send notifications to your team
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Send Notification</DialogTitle>
                <DialogDescription>
                  Send a notification to one or more employees
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto space-y-4 py-4">
                {/* Recipients */}
                <div className="space-y-2">
                  <Label>Recipients</Label>
                  <div className="rounded-lg border p-3 max-h-40 overflow-y-auto">
                    <div className="flex items-center space-x-2 pb-2 border-b mb-2">
                      <Checkbox
                        id="select-all"
                        checked={selectAll}
                        onCheckedChange={handleSelectAll}
                      />
                      <label htmlFor="select-all" className="text-sm font-medium">
                        Select All Employees
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {employees.map((emp) => (
                        <div key={emp.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={emp.id}
                            checked={selectedEmployees.includes(emp.id)}
                            onCheckedChange={() => handleEmployeeToggle(emp.id)}
                          />
                          <label htmlFor={emp.id} className="text-sm">
                            {emp.full_name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedEmployees.length} recipient(s) selected
                  </p>
                </div>

                {/* Template Selection */}
                {templates.length > 0 && (
                  <div className="space-y-2">
                    <Label>Use Template (Optional)</Label>
                    <Select onValueChange={handleTemplateSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Type */}
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Notification title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                {/* Rich Text Message */}
                <div className="space-y-2">
                  <Label>Message</Label>
                  <RichTextEditor
                    value={formData.message}
                    onChange={(value) => setFormData({ ...formData, message: value })}
                    placeholder="Write your notification message with formatting..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports **bold**, *italic*, headers, and lists
                  </p>
                </div>

                {/* Attachment */}
                <div className="space-y-2">
                  <Label>Attachment (Optional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {attachmentFile ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="flex-1 text-sm truncate">{attachmentFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAttachmentFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Add Attachment
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">Max file size: 10MB</p>
                </div>
              </div>

              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendNotification} disabled={formLoading}>
                  {formLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploadingAttachment ? "Uploading..." : "Sending..."}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send ({selectedEmployees.length})
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Notification History */}
        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold mb-4">Notification History</h2>
          {history.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No notifications sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getTypeColor(notif.type)}`}>
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{notif.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(notif.type)}`}>
                        {notif.type}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>To: {notif.user?.full_name || "Unknown"}</span>
                      <span>•</span>
                      <span>{format(new Date(notif.created_at), "MMM d, h:mm a")}</span>
                      {notif.attachment_url && (
                        <>
                          <span>•</span>
                          <a
                            href={notif.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <Paperclip className="h-3 w-3" />
                            Attachment
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
