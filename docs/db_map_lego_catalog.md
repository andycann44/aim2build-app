    # lego_catalog.db schema map

- Generated: 2025-12-28 19:19:11Z
- Path: backend/app/data/lego_catalog.db

## colors

```
0|color_id|INTEGER|0||1
1|name|TEXT|1||0
2|rgb|TEXT|1||0
3|is_trans|INTEGER|1|0|0
```

**Indexes**

```
```

## element_family_map

```
0|family_part_num|TEXT|1||1
1|element_id|TEXT|1||2
```

**Indexes**

```
0|idx_efm_elem|0|c|0
1|idx_element_family_map_family|0|c|0
2|sqlite_autoindex_element_family_map_1|1|pk|0
```

## element_images

```
0|part_num|TEXT|1||1
1|color_id|INTEGER|1||2
2|img_url|TEXT|1||0
```

**Indexes**

```
0|idx_ei_part_color|0|c|0
1|sqlite_autoindex_element_images_1|1|pk|0
```

## elements

```
0|element_id|TEXT|0||1
1|part_num|TEXT|1||0
2|color_id|INTEGER|0||0
3|design_id|TEXT|0||0
4|element_img_url|TEXT|0||0
5|element_url|TEXT|0||0
6|year_from|INTEGER|0||0
7|year_to|INTEGER|0||0
```

**Indexes**

```
0|idx_elements_part_color|0|c|0
1|idx_elements_elem|0|c|0
2|sqlite_autoindex_elements_1|1|pk|0
```

## instruction_set_elements

```
0|set_num|TEXT|1||1
1|element_id|TEXT|1||2
2|qty|INTEGER|1||0
3|source|TEXT|1|'pdf'|0
4|created_at|TEXT|1|datetime('now')|0
```

**Indexes**

```
0|sqlite_autoindex_instruction_set_elements_1|1|pk|0
```

## instruction_set_requirements

```
0|set_num|TEXT|1||1
1|family_part_num|TEXT|1||2
2|color_id|INTEGER|1||3
3|qty|INTEGER|1||0
4|source|TEXT|1|'pdf'|0
5|created_at|TEXT|1|datetime('now')|0
```

**Indexes**

```
0|sqlite_autoindex_instruction_set_requirements_1|1|pk|0
```

## inventories

```
0|inventory_id|INTEGER|0||1
1|set_num|TEXT|1||0
2|version|INTEGER|0||0
```

**Indexes**

```
```

## inventory_minifigs

```
0|inventory_id|INTEGER|1||0
1|fig_num|TEXT|1||0
2|quantity|INTEGER|0||0
```

**Indexes**

```
```

## inventory_parts

```
0|inventory_id|INTEGER|1||0
1|part_num|TEXT|1||0
2|color_id|INTEGER|0||0
3|quantity|INTEGER|0||0
4|is_spare|INTEGER|0||0
5|element_id|TEXT|0||0
```

**Indexes**

```
```

## inventory_parts_summary

```
0|set_num|TEXT|1||1
1|part_num|TEXT|1||2
2|color_id|INTEGER|1||3
3|quantity|INTEGER|1||0
4|part_img_url|TEXT|0||0
```

**Indexes**

```
0|idx_invparts_summary_part_color|0|c|0
1|idx_invparts_summary_set|0|c|0
2|sqlite_autoindex_inventory_parts_summary_1|1|pk|0
```

## minifigs

```
0|fig_num|TEXT|0||1
1|name|TEXT|1||0
2|num_parts|INTEGER|0||0
3|fig_img_url|TEXT|0||0
4|fig_url|TEXT|0||0
5|last_modified_dt|TEXT|0||0
```

**Indexes**

```
0|sqlite_autoindex_minifigs_1|1|pk|0
```

## part_canonical_map

```
0|part_num|TEXT|0||1
1|canonical_part_num|TEXT|1||0
```

**Indexes**

```
0|idx_pcm_part|0|c|0
1|sqlite_autoindex_part_canonical_map_1|1|pk|0
```

## part_categories

```
0|part_cat_id|INTEGER|0||1
1|name|TEXT|1||0
2|parent_id|INTEGER|0||0
```

**Indexes**

```
```

## part_family_map

```
0|family_key|TEXT|1||1
1|canonical_part_num|TEXT|1||0
2|part_num|TEXT|1||2
```

**Indexes**

```
0|idx_pfm_part|0|c|0
1|sqlite_autoindex_part_family_map_1|1|pk|0
```

## part_relationships

```
0|rel_type|TEXT|1||0
1|child_part_num|TEXT|1||0
2|parent_part_num|TEXT|1||0
3|is_spare|INTEGER|0||0
```

**Indexes**

```
```

## parts

```
0|part_num|TEXT|0||1
1|name|TEXT|1||0
2|part_cat_id|INTEGER|0||0
3|part_material|TEXT|0||0
4|part_url|TEXT|0||0
5|part_img_url|TEXT|0||0
6|part_thumb_url|TEXT|0||0
7|year_from|INTEGER|0||0
8|year_to|INTEGER|0||0
9|print_of|TEXT|0||0
10|mold|TEXT|0||0
11|is_obsolete|INTEGER|0||0
12|design_id|TEXT|0||0
```

**Indexes**

```
0|idx_parts_num|0|c|0
1|sqlite_autoindex_parts_1|1|pk|0
```

## set_parts

```
0|set_num|TEXT|1||1
1|part_num|TEXT|1||2
2|color_id|INTEGER|1||3
3|qty_per_set|INTEGER|1||0
4|part_img_url|TEXT|0||0
```

**Indexes**

```
0|idx_set_parts_lookup|0|c|0
1|sqlite_autoindex_set_parts_1|1|pk|0
```

## sets

```
0|set_num|TEXT|0||1
1|name|TEXT|1||0
2|year|INTEGER|0||0
3|theme_id|INTEGER|0||0
4|num_parts|INTEGER|0||0
5|set_img_url|TEXT|0||0
6|set_url|TEXT|0||0
7|last_modified_dt|TEXT|0||0
```

**Indexes**

```
0|idx_sets_theme|0|c|0
1|idx_sets_num|0|c|0
2|sqlite_autoindex_sets_1|1|pk|0
```

## themes

```
0|theme_id|INTEGER|0||1
1|name|TEXT|1||0
2|parent_id|INTEGER|0||0
```

**Indexes**

```
```

## truth_category_rules

```
0|category_name|TEXT|0||1
1|counts_for_buildability|INTEGER|1|1|0
2|counts_for_complete|INTEGER|1|1|0
```

**Indexes**

```
0|sqlite_autoindex_truth_category_rules_1|1|pk|0
```

## truth_gap_review

```
0|set_num|TEXT|1||0
1|part_num|TEXT|1||0
2|color_id|INTEGER|1||0
3|qty|INTEGER|1||0
4|side|TEXT|1||0
5|category|TEXT|1|'UNKNOWN'|0
6|note|TEXT|0||0
7|created_at|TEXT|1|datetime('now')|0
```

**Indexes**

```
0|idx_truth_gap_review_set|0|c|0
```

## users

```
0|id|INTEGER|0||1
1|email|TEXT|1||0
2|password_hash|TEXT|1||0
3|created_at|TEXT|1|CURRENT_TIMESTAMP|0
```

**Indexes**

```
0|sqlite_autoindex_users_1|1|u|0
```

