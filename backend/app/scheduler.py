"""
Backup Scheduler Module
Handles automatic scheduled backups based on configuration
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

scheduler: Optional[AsyncIOScheduler] = None
backup_job_id = "automatic_backup_job"

# Get local timezone - default to UTC if can't detect
try:
    import tzlocal
    LOCAL_TZ = tzlocal.get_localzone()
except:
    LOCAL_TZ = pytz.UTC


def run_backup_sync():
    """Synchronous wrapper to run async backup"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Schedule the coroutine in the running loop
            asyncio.ensure_future(run_automatic_backup())
        else:
            loop.run_until_complete(run_automatic_backup())
    except RuntimeError:
        # If no event loop, create a new one
        asyncio.run(run_automatic_backup())


async def run_automatic_backup():
    """Execute automatic backup - stores actual data for restore"""
    from .db import get_db
    
    print(f"[Scheduler] Starting automatic backup at {datetime.now()}")
    
    try:
        db = get_db()
        backups_coll = db.get_collection('backups')
        config_coll = db.get_collection('backup_config')
        
        # Get backup config
        config = await config_coll.find_one({'_id': 'backup_settings'})
        if not config or not config.get('autoBackupEnabled', True):
            print("[Scheduler] Auto backup is disabled, skipping...")
            return
        
        # Collections to backup - comprehensive list
        collection_names = [
            'staff', 'settings', 'system_config', 'roles', 'audit_logs',
            'attendance', 'shifts', 'performance_logs', 'menu_items', 'combo_meals',
            'orders', 'tables', 'ingredients', 'recipes', 'suppliers', 'purchases',
            'customers', 'coupons', 'membership_plans', 'discount_rules',
            'invoices', 'payments', 'notifications', 'tax_config', 'backup_config'
        ]
        
        # Export data from each collection  
        backup_data = {}
        document_counts = {}
        total_docs = 0
        
        for coll_name in collection_names:
            try:
                coll = db.get_collection(coll_name)
                docs = await coll.find().to_list(50000)
                # Serialize ObjectId to string
                serialized_docs = []
                for doc in docs:
                    serialized_doc = {}
                    for key, value in doc.items():
                        if hasattr(value, '__str__') and type(value).__name__ == 'ObjectId':
                            serialized_doc[key] = str(value)
                        else:
                            serialized_doc[key] = value
                    serialized_docs.append(serialized_doc)
                backup_data[coll_name] = serialized_docs
                document_counts[coll_name] = len(docs)
                total_docs += len(docs)
            except Exception as e:
                print(f"[Scheduler] Error backing up {coll_name}: {e}")
                backup_data[coll_name] = []
                document_counts[coll_name] = 0
        
        # Calculate backup size
        import json
        backup_json = json.dumps(backup_data, default=str)
        size_bytes = len(backup_json.encode('utf-8'))
        if size_bytes < 1024:
            size_str = f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            size_str = f"{size_bytes / 1024:.0f} KB"
        else:
            size_str = f"{size_bytes / (1024 * 1024):.0f} MB"
        
        now = datetime.now()
        backup_doc = {
            'name': f"Full Backup - {now.strftime('%Y-%m-%d')}",
            'size': size_str,
            'date': now.strftime('%Y-%m-%d'),
            'time': now.strftime('%H:%M:%S'),
            'status': 'completed',
            'type': 'automatic',
            'collections': collection_names,
            'documentCounts': document_counts,
            'totalDocuments': total_docs,
            'createdAt': now.isoformat(),
            # Store actual backup data for restore
            'backupData': backup_data
        }
        
        result = await backups_coll.insert_one(backup_doc)
        print(f"[Scheduler] Automatic backup created: {result.inserted_id} ({total_docs} documents, {size_str})")
        
        # Clean up old backups based on retention period.
        # createdAt is stored as an ISO-8601 string, so compare as string too.
        retention_days = config.get('retentionDays', 30)
        cutoff_date = now - timedelta(days=retention_days)
        cutoff_str = cutoff_date.isoformat()
        delete_result = await backups_coll.delete_many({
            'createdAt': {'$lt': cutoff_str},
            'type': 'automatic'  # Only delete automatic backups
        })
        if delete_result.deleted_count > 0:
            print(f"[Scheduler] Cleaned up {delete_result.deleted_count} old backups")
            
    except Exception as e:
        print(f"[Scheduler] Backup failed: {e}")
        import traceback
        traceback.print_exc()
        # Log failed backup
        try:
            from .db import get_db
            db = get_db()
            backups_coll_err = db.get_collection('backups')
            now = datetime.now()
            await backups_coll_err.insert_one({
                'name': f"Auto Backup - {now.strftime('%Y-%m-%d')} (Failed)",
                'size': '0 B',
                'date': now.strftime('%Y-%m-%d'),
                'time': now.strftime('%H:%M'),
                'status': 'failed',
                'type': 'automatic',
                'error': str(e),
                'createdAt': now.isoformat()
            })
        except Exception as e2:
            print(f"[Scheduler] Could not log failed backup: {e2}")


async def update_backup_schedule():
    """Update the backup schedule based on current config"""
    global scheduler
    
    if scheduler is None:
        print("[Scheduler] Scheduler not initialized yet")
        return
    
    from .db import get_db
    
    try:
        db = get_db()
        config_coll = db.get_collection('backup_config')
        config = await config_coll.find_one({'_id': 'backup_settings'})
        
        if not config:
            config = {
                'autoBackupEnabled': True,
                'frequency': 'daily',
                'backupTime': '02:00',
                'retentionDays': 30
            }
        
        # Remove existing job if any
        try:
            scheduler.remove_job(backup_job_id)
            print(f"[Scheduler] Removed existing backup job")
        except:
            pass
        
        if not config.get('autoBackupEnabled', True):
            print("[Scheduler] Auto backup is disabled")
            return
        
        frequency = config.get('frequency', 'daily')
        backup_time = config.get('backupTime', '02:00')
        
        # Parse time - handle both "HH:MM" and "HH:MM:SS" formats
        try:
            time_parts = backup_time.replace(' AM', '').replace(' PM', '').replace('AM', '').replace('PM', '').split(':')
            hour = int(time_parts[0])
            minute = int(time_parts[1]) if len(time_parts) > 1 else 0
            # Handle 12-hour format if AM/PM was in original
            if 'PM' in backup_time.upper() and hour < 12:
                hour += 12
            elif 'AM' in backup_time.upper() and hour == 12:
                hour = 0
        except Exception as e:
            print(f"[Scheduler] Error parsing time '{backup_time}': {e}, defaulting to 02:00")
            hour, minute = 2, 0
        
        # Create cron trigger based on frequency (using local timezone)
        if frequency == 'hourly':
            trigger = CronTrigger(minute=0, timezone=LOCAL_TZ)
        elif frequency == 'daily':
            trigger = CronTrigger(hour=hour, minute=minute, timezone=LOCAL_TZ)
        elif frequency == 'weekly':
            trigger = CronTrigger(day_of_week='sun', hour=hour, minute=minute, timezone=LOCAL_TZ)
        elif frequency == 'monthly':
            trigger = CronTrigger(day=1, hour=hour, minute=minute, timezone=LOCAL_TZ)
        else:
            trigger = CronTrigger(hour=hour, minute=minute, timezone=LOCAL_TZ)
        
        # Pass the async coroutine directly — AsyncIOScheduler awaits it
        # correctly on the event loop (no sync wrapper needed).
        scheduler.add_job(
            run_automatic_backup,
            trigger=trigger,
            id=backup_job_id,
            replace_existing=True,
            name="Automatic Database Backup"
        )
        
        # Get next run time for logging
        job = scheduler.get_job(backup_job_id)
        next_run = job.next_run_time if job else "unknown"
        
        print(f"[Scheduler] Backup scheduled: {frequency} at {hour:02d}:{minute:02d}")
        print(f"[Scheduler] Next backup: {next_run}")
        
    except Exception as e:
        print(f"[Scheduler] Error updating schedule: {e}")


def init_scheduler():
    """Initialize the scheduler"""
    global scheduler
    
    scheduler = AsyncIOScheduler(timezone=LOCAL_TZ)
    scheduler.start()
    print(f"[Scheduler] Scheduler initialized (timezone: {LOCAL_TZ})")


async def start_scheduler():
    """Start the scheduler and load initial config"""
    init_scheduler()
    await update_backup_schedule()


def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    global scheduler
    
    if scheduler:
        scheduler.shutdown(wait=False)
        print("[Scheduler] Scheduler shut down")
