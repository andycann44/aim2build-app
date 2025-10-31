from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
my_sets = {}

class OwnedSet(BaseModel):
    set_num: str
    name: str
    year: int
    img_url: str = ""

@router.get("/")
def list_my_sets():
    return list(my_sets.values())

@router.post("/")
def add_set(set_data: OwnedSet):
    if set_data.set_num in my_sets:
        raise HTTPException(status_code=400, detail="Set already exists")
    my_sets[set_data.set_num] = set_data.dict()
    return {"message": "Set added", "set": set_data}

@router.delete("/{set_num}")
def remove_set(set_num: str):
    if set_num not in my_sets:
        raise HTTPException(status_code=404, detail="Set not found")
    del my_sets[set_num]
    return {"message": "Set removed", "set_num": set_num}
