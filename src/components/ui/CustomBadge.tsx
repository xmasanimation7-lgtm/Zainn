import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        destructive: "bg-destructive/10 text-destructive",
        info: "bg-info/10 text-info",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

// Status-specific badges
export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: "success" | "warning" | "destructive" | "info" | "default"; label: string }> = {
    pending: { variant: "warning", label: "Pending" },
    in_progress: { variant: "info", label: "In Progress" },
    completed: { variant: "success", label: "Completed" },
    cancelled: { variant: "destructive", label: "Cancelled" },
    present: { variant: "success", label: "Present" },
    late: { variant: "warning", label: "Late" },
    absent: { variant: "destructive", label: "Absent" },
    leave: { variant: "info", label: "On Leave" },
  };

  const config = statusConfig[status] || { variant: "default" as const, label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const priorityConfig: Record<string, { variant: "success" | "warning" | "destructive" | "info" | "default"; label: string }> = {
    low: { variant: "success", label: "Low" },
    medium: { variant: "info", label: "Medium" },
    high: { variant: "warning", label: "High" },
    urgent: { variant: "destructive", label: "Urgent" },
  };

  const config = priorityConfig[priority] || { variant: "default" as const, label: priority };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const roleConfig: Record<string, { variant: "success" | "warning" | "destructive" | "info" | "default"; label: string }> = {
    admin: { variant: "destructive", label: "Admin" },
    employee: { variant: "default", label: "Employee" },
  };

  const config = roleConfig[role] || { variant: "default" as const, label: role };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
