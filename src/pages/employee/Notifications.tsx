import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell, AlertCircle, Info, CheckCircle, ExternalLink, Paperclip, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_type: string | null;
  related_id: string | null;
  attachment_url: string | null;
}

export default function EmployeeNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;

      try {
        const { data } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        setNotifications(data || []);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Real-time subscription
    const channel = supabase
      .channel('employee-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => console.log('Channel removal error:', err));
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Toggle expanded state
    setExpandedId(expandedId === notification.id ? null : notification.id);
  };

  const handleDeepLink = (notification: Notification) => {
    const relatedType = notification.related_type;
    const relatedId = notification.related_id;

    switch (relatedType) {
      case "task":
        navigate(`/employee/tasks${relatedId ? `?taskId=${relatedId}` : ''}`);
        break;
      case "leave":
        navigate("/employee/history?tab=leave");
        break;
      case "attendance":
        navigate("/employee/history?tab=attendance");
        break;
      default:
        // For system notifications without a specific target, stay expanded
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "task":
        return <Calendar className="h-5 w-5 text-primary" />;
      case "attendance":
        return <Clock className="h-5 w-5 text-info" />;
      default:
        return <Info className="h-5 w-5 text-info" />;
    }
  };

  const getTypeBgColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-success/10";
      case "warning":
        return "bg-warning/10";
      case "error":
        return "bg-destructive/10";
      case "task":
        return "bg-primary/10";
      default:
        return "bg-info/10";
    }
  };

  const getActionLabel = (relatedType: string | null) => {
    switch (relatedType) {
      case "task":
        return "View Task";
      case "leave":
        return "View Leave Request";
      case "attendance":
        return "View Attendance";
      default:
        return null;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <MobileLayout title="Notifications">
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        {unreadCount > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-muted-foreground">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </span>
            <button
              onClick={async () => {
                const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
                for (const id of unreadIds) {
                  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
                }
                setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
              }}
              className="text-sm text-primary font-medium"
            >
              Mark all as read
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl bg-card p-8 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const actionLabel = getActionLabel(notification.related_type);
              
              return (
                <div
                  key={notification.id}
                  className={`rounded-xl bg-card shadow-card overflow-hidden transition-all ${
                    !notification.is_read ? "border-l-4 border-primary" : ""
                  }`}
                >
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full text-left p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getTypeBgColor(notification.type)}`}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-medium truncate">{notification.title}</p>
                          {!notification.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        {expandedId === notification.id ? (
                          <div className="mb-2">
                            <MarkdownRenderer 
                              content={notification.message} 
                              className="text-sm text-muted-foreground"
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {notification.message.replace(/\*\*/g, '').replace(/\*/g, '')}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {notification.created_at && !isNaN(new Date(notification.created_at).getTime())
                            ? format(new Date(notification.created_at), "MMM d, h:mm a")
                            : "Unknown date"}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedId === notification.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-border mt-2">
                      <div className="flex items-center gap-3 mt-3">
                        {actionLabel && (
                          <button
                            onClick={() => handleDeepLink(notification)}
                            className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                            {actionLabel}
                          </button>
                        )}
                        {notification.attachment_url && (
                          <a
                            href={notification.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
                          >
                            <Paperclip className="h-4 w-4" />
                            View Attachment
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
