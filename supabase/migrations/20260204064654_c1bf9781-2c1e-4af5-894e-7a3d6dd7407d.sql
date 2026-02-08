-- =====================================================
-- Zainn Platform Enhancement Migration
-- Leave Management, Attendance Scheduling, Enhanced Notifications
-- =====================================================

-- 1. Create leave_requests table for leave management
CREATE TABLE public.leave_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'declined'))
);

-- 2. Create attendance_schedule table for admin-defined schedules
CREATE TABLE public.attendance_schedule (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    day_of_week INTEGER NOT NULL, -- 0 = Sunday, 1 = Monday, etc.
    check_in_start TIME NOT NULL DEFAULT '08:00:00',
    check_in_end TIME NOT NULL DEFAULT '09:30:00',
    check_out_start TIME NOT NULL DEFAULT '17:00:00',
    check_out_end TIME NOT NULL DEFAULT '18:30:00',
    is_working_day BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6)
);

-- 3. Add attachment_url column to notifications for file attachments
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS related_type TEXT,
ADD COLUMN IF NOT EXISTS related_id UUID;

-- 4. Create notification_templates table
CREATE TABLE public.notification_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Insert default attendance schedule (Mon-Fri working days)
INSERT INTO public.attendance_schedule (day_of_week, check_in_start, check_in_end, check_out_start, check_out_end, is_working_day) VALUES
(0, '08:00:00', '09:30:00', '17:00:00', '18:30:00', false), -- Sunday
(1, '08:00:00', '09:30:00', '17:00:00', '18:30:00', true),  -- Monday
(2, '08:00:00', '09:30:00', '17:00:00', '18:30:00', true),  -- Tuesday
(3, '08:00:00', '09:30:00', '17:00:00', '18:30:00', true),  -- Wednesday
(4, '08:00:00', '09:30:00', '17:00:00', '18:30:00', true),  -- Thursday
(5, '08:00:00', '09:30:00', '17:00:00', '18:30:00', true),  -- Friday
(6, '08:00:00', '09:30:00', '17:00:00', '18:30:00', false); -- Saturday

-- 6. Enable RLS on new tables
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for leave_requests
CREATE POLICY "Users can view own leave requests"
ON public.leave_requests FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own leave requests"
ON public.leave_requests FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending leave requests"
ON public.leave_requests FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can manage leave requests"
ON public.leave_requests FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. RLS policies for attendance_schedule (read by all, write by admin)
CREATE POLICY "Everyone can view attendance schedule"
ON public.attendance_schedule FOR SELECT
USING (true);

CREATE POLICY "Admins can manage attendance schedule"
ON public.attendance_schedule FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. RLS policies for notification_templates
CREATE POLICY "Admins can manage notification templates"
ON public.notification_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. Create storage bucket for notification attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 11. Storage policies for attachments bucket
CREATE POLICY "Attachments are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

CREATE POLICY "Admins can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attachments' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'attachments' AND has_role(auth.uid(), 'admin'::app_role));

-- 12. Create trigger for updated_at on new tables
CREATE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_schedule_updated_at
BEFORE UPDATE ON public.attendance_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
BEFORE UPDATE ON public.notification_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();