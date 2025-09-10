"""
Timezone utilities for consistent datetime handling across the application
"""
import pytz
from datetime import datetime, date, time
from typing import Optional

# Application timezone - Eastern Time
APP_TIMEZONE = pytz.timezone('America/New_York')
UTC = pytz.UTC

def get_app_timezone():
    """Get the application timezone"""
    return APP_TIMEZONE

def now_in_app_timezone():
    """Get current datetime in application timezone"""
    return datetime.now(APP_TIMEZONE)

def localize_to_app_timezone(dt: datetime) -> datetime:
    """Convert a naive datetime to application timezone"""
    if dt.tzinfo is None:
        return APP_TIMEZONE.localize(dt)
    return dt.astimezone(APP_TIMEZONE)

def to_utc_for_storage(dt: datetime) -> datetime:
    """Convert datetime to UTC for database storage"""
    if dt.tzinfo is None:
        # Assume it's in app timezone
        localized = APP_TIMEZONE.localize(dt)
    else:
        localized = dt
    return localized.astimezone(UTC)

def from_utc_to_app_timezone(dt: datetime) -> datetime:
    """Convert UTC datetime from database to app timezone for display"""
    if dt.tzinfo is None:
        # Assume it's UTC
        utc_dt = UTC.localize(dt)
    else:
        utc_dt = dt.astimezone(UTC)
    return utc_dt.astimezone(APP_TIMEZONE)

def combine_date_time_in_app_timezone(date_obj: date, time_obj: time) -> datetime:
    """Combine date and time objects in application timezone"""
    naive_dt = datetime.combine(date_obj, time_obj)
    return APP_TIMEZONE.localize(naive_dt)

def parse_frontend_datetime(date_str: str, time_str: str) -> datetime:
    """Parse date and time strings from frontend in application timezone"""
    # Parse date (YYYY-MM-DD) and time (HH:MM)
    year, month, day = map(int, date_str.split('-'))
    hour, minute = map(int, time_str.split(':'))
    
    # Create naive datetime
    naive_dt = datetime(year, month, day, hour, minute, 0)
    
    # Localize to application timezone
    return APP_TIMEZONE.localize(naive_dt)

def format_for_frontend(dt: datetime) -> dict:
    """Format datetime for frontend display"""
    app_dt = from_utc_to_app_timezone(dt)
    return {
        'date': app_dt.date().isoformat(),
        'time': app_dt.time().strftime('%H:%M'),
        'datetime': app_dt.isoformat(),
        'display': app_dt.strftime('%B %d, %Y at %I:%M %p')
    }
