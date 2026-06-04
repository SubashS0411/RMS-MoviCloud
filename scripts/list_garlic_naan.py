import requests
API_BASE='http://localhost:8000/api/admin'
try:
    r=requests.get(f'{API_BASE}/menu',timeout=10)
    r.raise_for_status()
    items=r.json()
except Exception as e:
    print('Failed to fetch menu:',e)
    raise
matches=[it for it in items if 'garlic naan' in (it.get('name') or '').lower()]
print('Found',len(matches),'matches')
for m in matches:
    print('id=', m.get('id') or m.get('_id'))
    print('name=', m.get('name'))
    print('image=', m.get('image'))
    print('---')
