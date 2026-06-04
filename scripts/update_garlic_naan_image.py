import requests
from pathlib import Path

API_BASE = 'http://localhost:8000/api/admin'
NEW_IMAGE = 'https://images.unsplash.com/photo-1626078501275-620d9a115c6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'

try:
    resp = requests.get(f'{API_BASE}/menu', timeout=10)
    resp.raise_for_status()
    items = resp.json()
except Exception as e:
    print('Failed to fetch menu items:', e)
    raise

# Find Garlic Naan (case-insensitive)
match = None
for it in items:
    name = (it.get('name') or '').strip().lower()
    if name == 'garlic naan' or 'garlic naan' in name:
        match = it
        break

if not match:
    print('Garlic Naan not found in menu. No changes made.')
    raise SystemExit(0)

item_id = match.get('id') or match.get('_id')
if not item_id:
    print('Menu item has no id; cannot update')
    raise SystemExit(1)

print('Found Garlic Naan with id:', item_id)

payload = {'image': NEW_IMAGE}
try:
    r = requests.put(f'{API_BASE}/menu/{item_id}', json=payload, timeout=10)
    r.raise_for_status()
    updated = r.json()
    print('Update successful. New image set to:', updated.get('image'))
except Exception as e:
    print('Failed to update Garlic Naan:', e)
    raise
