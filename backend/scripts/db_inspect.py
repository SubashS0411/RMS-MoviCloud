import os
import asyncio
from pprint import pprint
import os
from dotenv import load_dotenv

# Ensure dotenv values from backend/.env and app/.env are loaded for standalone script runs
BASE = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE, '.env'))
load_dotenv(os.path.join(BASE, 'app', '.env'))

from app import db as app_db

TARGET_COLLECTIONS = [
    'staff', 'menu_items', 'menu', 'orders', 'billing', 'customers', 'users', 'settings', 'system_config'
]

async def inspect():
    try:
        d = app_db.init_db()
        # If init_db returned a coroutine or async behavior, ensure db is awaited accordingly
        # app_db.init_db returns a motor database synchronously after client creation
        print('[db_inspect] Connected to DB:', getattr(d, 'name', repr(d)))
        try:
            cols = await d.list_collection_names()
        except Exception as e:
            print('[db_inspect] list_collection_names failed:', repr(e))
            cols = []

        print('\n[db_inspect] Collections present:')
        pprint(cols)

        for col in TARGET_COLLECTIONS:
            if col in cols:
                try:
                    count = await d[col].count_documents({})
                except Exception as e:
                    count = f'error: {e}'
                try:
                    sample = await d[col].find_one({})
                except Exception as e:
                    sample = f'error: {e}'
                print(f'\nCollection: {col}  -- documents: {count}')
                print('Sample doc:')
                pprint(sample)
            else:
                print(f'\nCollection: {col}  -- NOT FOUND')

    except Exception as exc:
        print('[db_inspect] Exception during inspection:')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(inspect())
