from app import db

try:
    d = db.init_db()
    print('[check_db] Connected to DB:', d.name)
    try:
        print('[check_db] Collections:', d.list_collection_names())
    except Exception as e:
        print('[check_db] Could not list collections:', repr(e))
except Exception as e:
    import traceback
    traceback.print_exc()
