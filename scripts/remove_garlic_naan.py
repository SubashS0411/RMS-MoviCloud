import requests
API_BASE='http://localhost:8000/api/admin'

try:
    r=requests.get(f'{API_BASE}/menu', timeout=10)
    r.raise_for_status()
    items=r.json()
except Exception as e:
    print('Failed to fetch menu:', e)
    raise

matches=[it for it in items if 'garlic naan' in (it.get('name') or '').lower()]
if not matches:
    print('No Garlic Naan items found.')
else:
    for m in matches:
        item_id = m.get('id') or m.get('_id')
        if not item_id:
            print('Skipping item without id:', m)
            continue
        try:
            resp = requests.delete(f'{API_BASE}/menu/{item_id}', timeout=10)
            resp.raise_for_status()
            print('Deleted Garlic Naan id=', item_id)
        except Exception as e:
            print('Failed to delete', item_id, '->', e)
