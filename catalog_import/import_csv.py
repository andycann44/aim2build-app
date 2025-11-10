import os, csv
from .db import db
def import_catalog(dir_path: str):
    dir_path = os.path.abspath(os.path.expanduser(dir_path))
    req = ["sets.csv","parts.csv","colors.csv","inventories.csv","inventory_parts.csv"]
    for f in req:
        if not os.path.isfile(os.path.join(dir_path,f)):
            raise FileNotFoundError(f"Missing {f} in {dir_path}")
    # (re)create tables
    with db() as con:
        con.executescript(open(os.path.join(os.path.dirname(__file__),"schema.sql")).read())
    def load(table, cols, fname, conv=lambda r:r):
        fp = os.path.join(dir_path,fname); n=0; rows=[]
        with db() as con, open(fp,newline='',encoding='utf-8') as fh:
            rd = csv.DictReader(fh)
            for r in rd:
                r = conv(r); rows.append(tuple(r[c] for c in cols))
                if len(rows)>=1000:
                    con.executemany(f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES ({','.join(['?']*len(cols))})", rows); n+=len(rows); rows=[]
            if rows:
                con.executemany(f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES ({','.join(['?']*len(cols))})", rows); n+=len(rows)
        return n
    s1 = load("sets",["set_num","name","year","theme_id"],"sets.csv",lambda r:{"set_num":r["set_num"],"name":r["name"],"year":int(r.get("year") or 0),"theme_id":int(r.get("theme_id") or 0)})
    s2 = load("parts",["part_num","name","part_cat_id"],"parts.csv",lambda r:{"part_num":r["part_num"],"name":r["name"],"part_cat_id":int(r.get("part_cat_id") or 0)})
    s3 = load("colors",["color_id","name","rgb","is_trans"],"colors.csv",lambda r:{"color_id":int(r.get("id") or r.get("color_id")),"name":r["name"],"rgb":r.get("rgb") or "","is_trans":int(r.get("is_trans") or 0)})
    s4 = load("inventories",["id","version","set_num"],"inventories.csv",lambda r:{"id":int(r["id"]),"version":int(r.get("version") or 1),"set_num":r["set_num"]})
    s5 = load("inventory_parts",["inventory_id","part_num","color_id","qty","is_spare"],"inventory_parts.csv",
              lambda r:{"inventory_id":int(r["inventory_id"]),"part_num":r["part_num"],"color_id":int(r.get("color_id") or 0),"qty":int(r.get("qty") or 0),"is_spare":int(r.get("is_spare") or 0)})
    with db() as con:
        con.execute("DELETE FROM set_parts")
        con.execute("""
          INSERT INTO set_parts(set_num,part_num,color_id,qty_per_set)
          SELECT i.set_num, ip.part_num, ip.color_id, SUM(ip.qty)
          FROM inventories i JOIN inventory_parts ip ON ip.inventory_id=i.id
          WHERE ip.is_spare=0
          GROUP BY i.set_num, ip.part_num, ip.color_id
        """)
        sp = con.execute("SELECT COUNT(*) AS n FROM set_parts").fetchone()["n"]
    return {"ok":True,"inserted":{"sets":s1,"parts":s2,"colors":s3,"inventories":s4,"inventory_parts":s5},"set_parts":sp,"dir":dir_path}
