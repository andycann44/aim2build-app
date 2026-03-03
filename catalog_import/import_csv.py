# WARNING:
# This module DESTRUCTIVELY rebuilds lego_catalog.db.
# It DROPS and RECREATES tables.
#
# DO NOT run against a live catalog DB.
# Intended for fresh bootstrap only.

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Sequence, Any, Set

from .csv_std import csv_module as csv
from .db import db


TRUE_VALUES = {"1", "true", "t", "yes", "y"}


def _first(row: Dict[str, str], *keys: str) -> Optional[str]:
    for key in keys:
        if not key:
            continue
        if key in row:
            value = row[key]
            if value is None:
                continue
            value = value.strip()
            if value:
                return value
    return None


def _to_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        try:
            return int(float(value))
        except ValueError:
            return None


def _to_bool(value: Optional[str]) -> int:
    if value is None:
        return 0
    return 1 if value.strip().lower() in TRUE_VALUES else 0


def _to_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value if value else None


@dataclass
class ColumnSpec:
    name: str
    sql_type: str
    extractor: Callable[[Dict[str, str]], Any]
    required: bool = False


@dataclass
class DatasetSpec:
    table: str
    filename: str
    columns: Sequence[ColumnSpec]
    row_filter: Optional[Callable[[Dict[str, str]], bool]] = None


def _dataset_specs() -> Sequence[DatasetSpec]:
    return [
        DatasetSpec(
            table="colors",
            filename="colors.csv",
            columns=[
                ColumnSpec(
                    "color_id",
                    "INTEGER PRIMARY KEY",
                    lambda row: _to_int(_first(row, "id", "color_id")),
                    required=True,
                ),
                ColumnSpec(
                    "name",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "name")) or "",
                ),
                ColumnSpec(
                    "rgb",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "rgb")) or "",
                ),
                ColumnSpec(
                    "is_trans",
                    "INTEGER NOT NULL DEFAULT 0",
                    lambda row: _to_bool(_first(row, "is_trans", "transparent", "is_transparent")),
                ),
            ],
        ),
        DatasetSpec(
            table="part_categories",
            filename="part_categories.csv",
            columns=[
                ColumnSpec(
                    "part_cat_id",
                    "INTEGER PRIMARY KEY",
                    lambda row: _to_int(_first(row, "id", "part_cat_id")),
                    required=True,
                ),
                ColumnSpec(
                    "name",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "name")) or "",
                ),
                ColumnSpec(
                    "parent_id",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "parent_id")),
                ),
            ],
        ),
        DatasetSpec(
            table="parts",
            filename="parts.csv",
            columns=[
                ColumnSpec(
                    "part_num",
                    "TEXT PRIMARY KEY",
                    lambda row: _to_text(_first(row, "part_num")),
                    required=True,
                ),
                ColumnSpec(
                    "name",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "name")) or "",
                ),
                ColumnSpec(
                    "part_cat_id",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "part_cat_id")),
                ),
                ColumnSpec(
                    "part_material",
                    "TEXT",
                    lambda row: _to_text(_first(row, "part_material", "material")),
                ),
                ColumnSpec(
                    "part_url",
                    "TEXT",
                    lambda row: _to_text(_first(row, "part_url", "url")),
                ),
                ColumnSpec(
                    "part_img_url",
                    "TEXT",
                    lambda row: _to_text(_first(row, "part_img_url", "img_url")),
                ),
                ColumnSpec(
                    "part_thumb_url",
                    "TEXT",
                    lambda row: _to_text(_first(row, "part_img_url_small", "part_thumb_url")),
                ),
                ColumnSpec(
                    "year_from",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "year_from")),
                ),
                ColumnSpec(
                    "year_to",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "year_to")),
                ),
                ColumnSpec(
                    "print_of",
                    "TEXT",
                    lambda row: _to_text(_first(row, "print_of")),
                ),
                ColumnSpec(
                    "mold",
                    "TEXT",
                    lambda row: _to_text(_first(row, "mold")),
                ),
                ColumnSpec(
                    "is_obsolete",
                    "INTEGER",
                    lambda row: _to_bool(_first(row, "is_obsolete")),
                ),
                ColumnSpec(
                    "design_id",
                    "TEXT",
                    lambda row: _to_text(_first(row, "design_id")),
                ),
            ],
        ),
        DatasetSpec(
            table="part_relationships",
            filename="part_relationships.csv",
            columns=[
                ColumnSpec(
                    "rel_type",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "rel_type")) or "",
                ),
                ColumnSpec(
                    "child_part_num",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "child_part_num")) or "",
                ),
                ColumnSpec(
                    "parent_part_num",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "parent_part_num")) or "",
                ),
                ColumnSpec(
                    "is_spare",
                    "INTEGER",
                    lambda row: _to_bool(_first(row, "is_spare")),
                ),
            ],
        ),
        DatasetSpec(
            table="elements",
            filename="elements.csv",
            columns=[
                ColumnSpec(
                    "element_id",
                    "TEXT PRIMARY KEY",
                    lambda row: _to_text(_first(row, "element_id")),
                    required=True,
                ),
                ColumnSpec(
                    "part_num",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "part_num")) or "",
                ),
                ColumnSpec(
                    "color_id",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "color_id")),
                ),
                ColumnSpec(
                    "design_id",
                    "TEXT",
                    lambda row: _to_text(_first(row, "design_id")),
                ),
                ColumnSpec(
                    "element_img_url",
                    "TEXT",
                    lambda row: _to_text(_first(row, "element_img_url", "img_url")),
                ),
                ColumnSpec(
                    "element_url",
                    "TEXT",
                    lambda row: _to_text(_first(row, "element_url", "url")),
                ),
                ColumnSpec(
                    "year_from",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "year_from")),
                ),
                ColumnSpec(
                    "year_to",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "year_to")),
                ),
            ],
        ),
        DatasetSpec(
            table="themes",
            filename="themes.csv",
            columns=[
                ColumnSpec(
                    "theme_id",
                    "INTEGER PRIMARY KEY",
                    lambda row: _to_int(_first(row, "id", "theme_id")),
                    required=True,
                ),
                ColumnSpec(
                    "name",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "name")) or "",
                ),
                ColumnSpec(
                    "parent_id",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "parent_id")),
                ),
            ],
        ),
        DatasetSpec(
            table="sets",
            filename="sets.csv",
            columns=[
                ColumnSpec(
                    "set_num",
                    "TEXT PRIMARY KEY",
                    lambda row: _to_text(_first(row, "set_num")),
                    required=True,
                ),
                ColumnSpec(
                    "name",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "name")) or "",
                ),
                ColumnSpec(
                    "year",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "year")),
                ),
                ColumnSpec(
                    "theme_id",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "theme_id")),
                ),
                ColumnSpec(
                    "num_parts",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "num_parts")),
                ),
                ColumnSpec(
                    "set_img_url",
                    "TEXT",
                    lambda row: _to_text(_first(row, "set_img_url", "img_url")),
                ),
                ColumnSpec(
                    "set_url",
                    "TEXT",
                    lambda row: _to_text(_first(row, "set_url", "url")),
                ),
                ColumnSpec(
                    "last_modified_dt",
                    "TEXT",
                    lambda row: _to_text(_first(row, "last_modified_dt")),
                ),
            ],
        ),
        DatasetSpec(
            table="inventories",
            filename="inventories.csv",
            columns=[
                ColumnSpec(
                    "inventory_id",
                    "INTEGER PRIMARY KEY",
                    lambda row: _to_int(_first(row, "id", "inventory_id")),
                    required=True,
                ),
                ColumnSpec(
                    "set_num",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "set_num")) or "",
                ),
                ColumnSpec(
                    "version",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "version")),
                ),
            ],
        ),
        DatasetSpec(
            table="inventory_parts",
            filename="inventory_parts.csv",
            columns=[
                ColumnSpec(
                    "inventory_id",
                    "INTEGER NOT NULL",
                    lambda row: _to_int(_first(row, "inventory_id")),
                    required=True,
                ),
                ColumnSpec(
                    "part_num",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "part_num")) or "",
                ),
                ColumnSpec(
                    "color_id",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "color_id")),
                ),
                ColumnSpec(
                    "quantity",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "quantity", "qty")),
                ),
                ColumnSpec(
                    "is_spare",
                    "INTEGER",
                    lambda row: _to_bool(_first(row, "is_spare")),
                ),
                ColumnSpec(
                    "element_id",
                    "TEXT",
                    lambda row: _to_text(_first(row, "element_id")),
                ),
            ],
        ),
        DatasetSpec(
            table="inventory_minifigs",
            filename="inventory_minifigs.csv",
            columns=[
                ColumnSpec(
                    "inventory_id",
                    "INTEGER NOT NULL",
                    lambda row: _to_int(_first(row, "inventory_id")),
                    required=True,
                ),
                ColumnSpec(
                    "fig_num",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "fig_num")) or "",
                ),
                ColumnSpec(
                    "quantity",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "quantity", "qty")),
                ),
            ],
        ),
        DatasetSpec(
            table="minifigs",
            filename="minifigs.csv",
            columns=[
                ColumnSpec(
                    "fig_num",
                    "TEXT PRIMARY KEY",
                    lambda row: _to_text(_first(row, "fig_num")),
                    required=True,
                ),
                ColumnSpec(
                    "name",
                    "TEXT NOT NULL",
                    lambda row: _to_text(_first(row, "name")) or "",
                ),
                ColumnSpec(
                    "num_parts",
                    "INTEGER",
                    lambda row: _to_int(_first(row, "num_parts")),
                ),
                ColumnSpec(
                    "fig_img_url",
                    "TEXT",
                    lambda row: _to_text(_first(row, "fig_img_url", "img_url")),
                ),
                ColumnSpec(
                    "fig_url",
                    "TEXT",
                    lambda row: _to_text(_first(row, "fig_url", "set_url", "url")),
                ),
                ColumnSpec(
                    "last_modified_dt",
                    "TEXT",
                    lambda row: _to_text(_first(row, "last_modified_dt")),
                ),
            ],
        ),
    ]


def _ensure_exists(base_dir: str, filename: str) -> str:
    path = os.path.join(base_dir, filename)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Missing required file: {filename} in {base_dir}")
    return path


def _get_table_columns(con, table: str) -> Set[str]:
    rows = con.execute(f"PRAGMA table_info(\"{table}\")").fetchall()
    return {row[1] for row in rows}


def _load_dataset(con, base_dir: str, spec: DatasetSpec) -> int:
    path = _ensure_exists(base_dir, spec.filename)
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames is None:
            raise ValueError(f"{spec.filename} has no header")

        col_defs = ", ".join(f"{col.name} {col.sql_type}" for col in spec.columns)
        con.execute(f"CREATE TABLE IF NOT EXISTS {spec.table} ({col_defs})")

        db_cols = {row[1] for row in con.execute(f"PRAGMA table_info({spec.table})")}
        csv_cols = set(reader.fieldnames or [])
        extra = sorted(csv_cols - db_cols)
        if extra:
            print(f"[a2b] {spec.table}: ignoring CSV-only columns: {extra[:20]}")
        insert_cols = [c for c in spec.columns if c.name in db_cols and c.name in csv_cols]
        if not insert_cols:
            raise ValueError(f"No matching columns for {spec.table} between CSV and DB")

        placeholders = ", ".join("?" for _ in insert_cols)
        col_names = ", ".join(col.name for col in insert_cols)
        insert_sql = f"INSERT OR IGNORE INTO {spec.table} ({col_names}) VALUES ({placeholders})"

        batch: List[List[Any]] = []
        inserted = 0
        for row in reader:
            if spec.row_filter and not spec.row_filter(row):
                continue
            values: List[Any] = []
            skip_row = False
            for col in insert_cols:
                value = row.get(col.name, "")
                if col.required and value in (None, ""):
                    skip_row = True
                    break
                values.append(value)
            if skip_row:
                continue
            batch.append(values)
            if len(batch) >= 1000:
                con.executemany(insert_sql, batch)
                inserted += len(batch)
                batch.clear()
        if batch:
            con.executemany(insert_sql, batch)
            inserted += len(batch)
    return inserted


def _build_summary_tables(con) -> Dict[str, int]:
    summary_counts: Dict[str, int] = {}

    con.execute("CREATE INDEX IF NOT EXISTS idx_sets_num ON sets(set_num)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_sets_theme ON sets(theme_id)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_parts_num ON parts(part_num)")

    return summary_counts


def import_catalog(dir_path: str) -> Dict[str, Any]:
    base_dir = os.path.abspath(os.path.expanduser(dir_path))
    specs = _dataset_specs()

    for spec in specs:
        _ensure_exists(base_dir, spec.filename)

    inserted: Dict[str, int] = {}
    summary: Dict[str, int] = {}

    with db() as con:
        for spec in specs:
            inserted[spec.table] = _load_dataset(con, base_dir, spec)
        summary = _build_summary_tables(con)

    return {"ok": True, "dir": base_dir, "inserted": inserted, "summary": summary}

