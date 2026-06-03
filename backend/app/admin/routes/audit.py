from fastapi import APIRouter, HTTPException, Request
from ...db import init_db, get_db
from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId

router = APIRouter()


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(v) if isinstance(v, dict) else str(v) if isinstance(v, ObjectId) else v for v in value]
            else:
                result[key] = value
        return result
    return doc


def to_object_id(id_str: str):
    """Convert string ID to ObjectId, or return the string if invalid"""
    try:
        return ObjectId(id_str)
    except Exception:
        return id_str


@router.get('/', tags=['audit'])
async def list_audit(
    action: str = None,
    userId: str = None,
    resource: str = None,
    status: str = None,
    date_from: str = None,
    date_to: str = None,
    limit: int = 100,
    skip: int = 0
):
    """List audit logs with optional filters"""
    db = get_db()
    coll = db.get_collection('audit_logs')
    filt = {}
    
    if action:
        filt['action'] = action
    if userId:
        filt['userId'] = userId
    if resource:
        filt['resource'] = resource
    if status:
        filt['status'] = status
    if date_from:
        filt['createdAt'] = {'$gte': date_from}
    if date_to:
        if 'createdAt' in filt:
            filt['createdAt']['$lte'] = date_to
        else:
            filt['createdAt'] = {'$lte': date_to}
    
    docs = await coll.find(filt).sort('createdAt', -1).skip(skip).limit(min(limit, 1000)).to_list(1000)
    total = await coll.count_documents(filt)
    
    return {
        'data': serialize_doc(docs),
        'total': total,
        'skip': skip,
        'limit': limit
    }


@router.get('/stats', tags=['audit'])
async def get_audit_stats():
    """Get audit log statistics"""
    db = get_db()
    coll = db.get_collection('audit_logs')
    
    # Get counts by action
    action_pipeline = [
        {'$group': {'_id': '$action', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 10}
    ]
    by_action = await coll.aggregate(action_pipeline).to_list(10)
    
    # Get counts by resource
    resource_pipeline = [
        {'$group': {'_id': '$resource', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 10}
    ]
    by_resource = await coll.aggregate(resource_pipeline).to_list(10)
    
    # Get counts by user
    user_pipeline = [
        {'$group': {'_id': '$userName', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 10}
    ]
    by_user = await coll.aggregate(user_pipeline).to_list(10)
    
    # Get counts by status
    status_pipeline = [
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
    ]
    by_status = await coll.aggregate(status_pipeline).to_list(10)
    
    # Total count
    total = await coll.count_documents({})
    
    # Today's count
    today = datetime.utcnow().strftime('%Y-%m-%d')
    today_count = await coll.count_documents({'createdAt': {'$regex': f'^{today}'}})
    
    return {
        'total': total,
        'today': today_count,
        'byAction': {r['_id']: r['count'] for r in by_action if r['_id']},
        'byResource': {r['_id']: r['count'] for r in by_resource if r['_id']},
        'byUser': {r['_id']: r['count'] for r in by_user if r['_id']},
        'byStatus': {r['_id']: r['count'] for r in by_status if r['_id']}
    }


@router.get('/actions', tags=['audit'])
async def get_unique_actions():
    """Get list of unique actions in audit logs"""
    db = get_db()
    coll = db.get_collection('audit_logs')
    actions = await coll.distinct('action')
    return actions


@router.get('/resources', tags=['audit'])
async def get_unique_resources():
    """Get list of unique resources in audit logs"""
    db = get_db()
    coll = db.get_collection('audit_logs')
    resources = await coll.distinct('resource')
    return resources


@router.get('/{id}', tags=['audit'])
async def get_audit(id: str):
    """Get a specific audit log by ID"""
    db = get_db()
    coll = db.get_collection('audit_logs')
    doc = await coll.find_one({'_id': to_object_id(id)})
    if not doc:
        raise HTTPException(status_code=404, detail='Not found')
    return serialize_doc(doc)


@router.delete('/cleanup', tags=['audit'])
async def cleanup_old_logs(days: int = 90, request: Request = None):
    """Delete audit logs older than specified days"""
    db = get_db()
    coll = db.get_collection('audit_logs')
    
    cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    result = await coll.delete_many({'createdAt': {'$lt': cutoff_date}})
    
    return {
        'success': True,
        'deleted_count': result.deleted_count,
        'message': f'Deleted {result.deleted_count} logs older than {days} days'
    }


@router.get('/export', tags=['audit'])
async def export_audit_logs(
    format: str = 'json',
    date_from: str = None,
    date_to: str = None,
    limit: int = 10000
):
    """Export audit logs for download"""
    db = get_db()
    coll = db.get_collection('audit_logs')
    filt = {}
    
    if date_from:
        filt['createdAt'] = {'$gte': date_from}
    if date_to:
        if 'createdAt' in filt:
            filt['createdAt']['$lte'] = date_to
        else:
            filt['createdAt'] = {'$lte': date_to}
    
    docs = await coll.find(filt).sort('createdAt', -1).limit(limit).to_list(limit)
    
    return {
        'data': serialize_doc(docs),
        'count': len(docs),
        'format': format,
        'exportedAt': datetime.utcnow().isoformat()
    }
