# Aim2Build — Compare Local vs Staging (DB + Backend + Frontend)

This is a safety-first comparison workflow to answer:

- Which SQLite DB file is actually being used?
- Are duplicates coming from DB rows, joins, or frontend rendering?
- Are image URLs coming from the intended resolver, and are we pointing at R2 / img domain?

We take a local snapshot, then fingerprint local, then fingerprint staging (read-only), then diff.

## What this script does

- Snapshots these DBs (if present):
  - backend/app/data/lego_catalog.db
  - backend/app/data/aim2build_app.db
  - backend/app/data/*.db
- Records fingerprints:
  - file size + sha256
  - sets count + year range (catalog DB)
  - indices list (both DBs)
  - schema dumps (both DBs)
- Optionally fingerprints staging over SSH (read-only).

## Requirements

- macOS / Linux
- sqlite3
- python3
- shasum -a 256 (macOS) or sha256sum (Linux)
- If using staging: ssh access

## Quick start

```bash
cd ~/aim2build-app
chmod +x ./a2p_compare_local_vs_staging.sh

./a2p_compare_local_vs_staging.sh snapshot
./a2p_compare_local_vs_staging.sh fingerprint-local

export A2P_STAGING_HOST="ubuntu@your-host"
export A2P_STAGING_PATH="/home/ubuntu/aim2build-app"
./a2p_compare_local_vs_staging.sh fingerprint-staging

./a2p_compare_local_vs_staging.sh diff
```

## Outputs

Everything goes to `./_compare_out/<timestamp>/...`

Attach/paste key files:
- local_fingerprint.txt
- staging_fingerprint.txt
- diff.txt
- local_schema_*.sql
- staging_schema_*.sql
