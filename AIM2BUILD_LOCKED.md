🔒 WHAT IS NOW LOCKED (WRITE THIS IN STONE)

1) Images
- Source: lego_catalog.db -> element_images
- No inventory_images
- No URL rewriting
- No fallbacks

2) Inventory
- Key = (part_num, color_id)
- color_id=0 valid
- Printed parts are distinct part_nums
- No family / canonical collapsing at runtime

3) Canonical endpoints (ONLY inventory mutation APIs)
- POST /api/inventory/add-canonical
- POST /api/inventory/set-canonical
- POST /api/inventory/decrement-canonical
