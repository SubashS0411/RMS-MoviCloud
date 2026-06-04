import re
import json
import requests
from pathlib import Path

FRONTEND_MENU = Path('frontend/src/client/app/data/menuData.ts')
API_BASE = 'http://localhost:8000/api/admin'

if not FRONTEND_MENU.exists():
    print('menuData.ts not found at', FRONTEND_MENU)
    raise SystemExit(1)

text = FRONTEND_MENU.read_text(encoding='utf-8')
start = text.find('export const menuData')
if start == -1:
    print('export const menuData not found')
    raise SystemExit(1)

# Find the array '[' after the assignment '=' to avoid matching type annotations like MenuItem[]
equal_pos = text.find('=', start)
arr_start = text.find('[', equal_pos)
arr_end = text.find('];', arr_start)
if arr_start == -1 or arr_end == -1:
    print('Could not locate menu array boundaries')
    raise SystemExit(1)

arr_text = text[arr_start:arr_end+1]
# Remove trailing commas before } or ] to make valid JSON
arr_text = re.sub(r',\s*(\}|\])', r"\1", arr_text)
# Quote unquoted object keys (simple heuristic) to convert JS object literal -> JSON
arr_text = re.sub(r'([\{\[,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', arr_text)
# Remove block comments only (avoid stripping '//' inside URLs)
arr_text = re.sub(r'/\*[\s\S]*?\*/', '', arr_text)
# Remove full-line '//' comments (keeps '//' inside strings intact)
arr_text = re.sub(r'^\s*//.*\n', '', arr_text, flags=re.M)

try:
    # Debug: show a preview of the transformed text
    print('---TRANSFORMED START (repr)---')
    print(repr(arr_text[:200]))
    print('---TRANSFORMED END---')
    menu_list = json.loads(arr_text)
except Exception as e:
    print('Failed to parse menuData as JSON:', e)
    raise

print(f'Parsed {len(menu_list)} menu items from frontend data')

# Fetch existing menu items
try:
    resp = requests.get(f'{API_BASE}/menu', timeout=10)
    resp.raise_for_status()
    existing = resp.json()
    existing_names = {m.get('name','').strip().lower() for m in existing}
    print(f'Found {len(existing)} existing menu items in DB')
except Exception as e:
    print('Failed to fetch existing menu from API:', e)
    raise

created = 0
for item in menu_list:
    name = item.get('name','').strip()
    if not name:
        continue
    if name.lower() in existing_names:
        print('Skipping (exists):', name)
        continue

    payload = {
        'name': name,
        'description': item.get('description',''),
        'price': item.get('price', 0),
        'image': item.get('image'),
        # backend expects dietType string
        'dietType': 'veg' if item.get('isVeg') else ('non-veg' if item.get('isVeg') is not None else item.get('dietType')),
        'category': item.get('category') or 'Uncategorized',
        'available': item.get('available', True),
        'popular': item.get('popular', False),
        'todaysSpecial': item.get('todaysSpecial', False),
        'calories': item.get('calories'),
        'prepTime': item.get('prepTime'),
        'offer': item.get('offer'),
        'cuisine': item.get('cuisine'),
    }

    try:
        r = requests.post(f'{API_BASE}/menu', json=payload, timeout=10)
        r.raise_for_status()
        created += 1
        print('Created:', name)
    except Exception as e:
        print('Failed to create', name, '->', e)

print(f'Import complete. Created {created} new menu items.')
