import asyncio
from dotenv import load_dotenv

load_dotenv('.env')
load_dotenv('app/.env')

from app.db import init_db


async def main():
    d = init_db()
    users = d['users']
    staff = d['staff']
    print('users_count=', await users.count_documents({}))
    print('staff_count=', await staff.count_documents({}))
    print('users_cashier=', await users.find_one({'email': 'cashier@restaurant.com'}, {'passwordHash': 0}))
    print('staff_cashier=', await staff.find_one({'email': 'cashier@restaurant.com'}, {'password_hash': 0}))


asyncio.run(main())
