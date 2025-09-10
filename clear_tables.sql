
-- Clear all appointments and calendar data
DELETE FROM calendar_notifications;
DELETE FROM scheduling_requests;  
DELETE FROM appointments;
DELETE FROM therapist_calendar_slots;

-- Verify tables are empty
SELECT 'appointments' as table_name, COUNT(*) as count FROM appointments
UNION ALL
SELECT 'therapist_calendar_slots', COUNT(*) FROM therapist_calendar_slots  
UNION ALL
SELECT 'scheduling_requests', COUNT(*) FROM scheduling_requests
UNION ALL
SELECT 'calendar_notifications', COUNT(*) FROM calendar_notifications;

