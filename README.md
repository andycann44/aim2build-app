# Aim2Build Branch Workflow Cheat Sheet

To integrate the recent part-image updates (or any feature work) without disturbing other branches, follow this loop:

1. **Check your current branch.**
   ```bash
   git status -sb
   ```
   The line beginning with `##` lists your active branch (e.g., `## work`).

2. **Switch to the branch you want to base the work on (often `main`).**
   ```bash
   git switch main
   git pull
   ```
   Pulling ensures you are up-to-date before starting new work.

3. **Create (or return to) the isolated feature branch.**
   ```bash
   git checkout -b feature/part-image-column  # first time only
   git switch feature/part-image-column      # use this once the branch already exists
   ```
   Do all schema/import/CSV edits here so your other branches stay untouched.

   Once the branch is checked out, simply edit files as usual—run VS Code, apply patches, update
   CSVs, etc. Any modifications you save while this branch is active remain scoped to it until you
   merge or cherry-pick them elsewhere.

4. **Test and review.**
   Run the relevant commands (e.g., `npm run lint`, backend/unit tests, or `a2b_refresh_catalog.sh`) to verify everything works on the feature branch.

5. **Commit and push when satisfied.**
   ```bash
   git commit -am "Describe your change"
   git push -u origin feature/part-image-column
   ```

6. **Return to other branches after merging.**
   Once the feature branch is merged (or no longer needed), switch back:
   ```bash
   git switch work
   ```

Following these steps keeps the new catalog changes isolated until you explicitly merge them, so nothing crashes the branches you are not ready to update yet.

---

## Updating the local catalog database

Any time the importer/schema changes (like adding the `part_img_url` column) you need to rebuild the SQLite catalog. Do this entirely inside the feature branch so the refresh stays isolated:

> **Shortcut:** if you simply want everything handled for you, run `./a2b_refresh_catalog_full.sh` from
> the repo root. The helper will bootstrap `pip` (via `python3 -m ensurepip` if needed), install the
> importer requirements, auto-detect the latest Rebrickable export directory, and then invoke
> `./a2b_refresh_catalog.sh`. The manual steps below are still documented in case you prefer the
> explicit workflow or need to troubleshoot individual stages.

1. **Ensure Python dependencies are installed.** First `cd` into the repository root (the folder
   that contains this README, `catalog_import/`, `backend/`, etc.). Running the command from your
   home directory (`~`) triggers `Could not open requirements file` because the relative path does
   not exist there.
   ```bash
   cd /path/to/aim2build-app
   python3 -m pip install -r catalog_import/requirements.txt
   ```
   (The importer currently uses only the Python standard library, so the requirements file is a
   placeholder. Running the command keeps the workflow consistent and gives us a single spot to
   add packages later. Using `python3 -m pip` works even when a standalone `pip` binary is not on
   your shell `PATH`.)

2. **Run the refresh helper from the repo root.** This downloads the latest Rebrickable CSV export, drops the old `backend/app/data/lego_catalog.db`, and recreates it with the new columns. The helper automatically sniffs Rebrickable's current date-stamped download directory, so you do not have to manually keep the URLs in sync. If your firewall blocks that detection, use one of these approaches _with the directory you see today_ (the sample date below will go stale):

   ```bash
   # (Preferred) pipe the detector output straight into the env var
   export REBRICKABLE_EXPORT_BASE=$(python3 catalog_import/discover_rebrickable_export_base.py)
   # or manually copy the newest directory from https://rebrickable.com/downloads/
   export REBRICKABLE_EXPORT_BASE=https://cdn.rebrickable.com/media/downloads/YYYY-MM-DD
   ```

   Re-using an older date such as `2024-06-15` will 404 once Rebrickable rotates the exports.
   ```bash
   ./a2b_refresh_catalog.sh
   ```

3. **Spot-check the results (optional but recommended).** If you have `sqlite3` installed, the script prints row counts automatically. You can also inspect the schema yourself. **Always prefix the database path with `sqlite3`; running `backend/app/data/lego_catalog.db` directly just tries to execute the binary file and results in `Permission denied`.**
   ```bash
   sqlite3 backend/app/data/lego_catalog.db \
     '.schema inventory_parts_summary' \
     'SELECT part_num, part_img_url FROM inventory_parts_summary LIMIT 5;'
   ```

Because the database file lives inside your working tree, rerunning the script on another branch will regenerate the older schema if needed. That makes it safe to refresh only on the branches that require the new column.

### Troubleshooting

**`pip: command not found`**

Some macOS/Linux setups do not expose the `pip` command even though Python ships with it. Running
the following sequence once per machine bootstraps `pip` and installs the importer requirements:

```bash
python3 -m ensurepip --upgrade
python3 -m pip install --upgrade pip
python3 -m pip install -r catalog_import/requirements.txt
```

If your Python executable is named differently, substitute `python` or `py -3` accordingly.

**`Could not open requirements file: No such file or directory`**

This usually means the command is being run from another directory (e.g., `~`) where the
`catalog_import/requirements.txt` path does not exist. Either `cd` into the repository root first
or provide the absolute path to the file:

```bash
cd /path/to/aim2build-app
python3 -m pip install -r catalog_import/requirements.txt
# or
python3 -m pip install -r /path/to/aim2build-app/catalog_import/requirements.txt
```

**`backend/app/data/lego_catalog.db: Permission denied`**

This error appears when the database file itself is executed instead of opened with SQLite (e.g.,
running `backend/app/data/lego_catalog.db` as a command). Always prefix inspection commands with
`sqlite3`:

```bash
sqlite3 backend/app/data/lego_catalog.db '.tables'
```

That opens the file for reading, while the `./a2b_refresh_catalog.sh` helper handles recreating it.

**`curl: (56) The requested URL returned error: 404`**

Rebrickable periodically moves the CSV export into date-stamped directories. The refresh script now
tries to auto-detect the newest directory before downloading, and if a manual
`REBRICKABLE_EXPORT_BASE` override fails it automatically falls back to the detected directory and
retries the download once. Any failure still emits a horizontal divider, the attempted URL, and the
curl exit status so you can see which download broke before re-running the detector. Resolve the
issue by letting the script re-detect (`unset REBRICKABLE_EXPORT_BASE`) or by exporting the value
that the helper prints:

```bash
export REBRICKABLE_EXPORT_BASE=$(python3 catalog_import/discover_rebrickable_export_base.py)
./a2b_refresh_catalog.sh
```

If you copy the directory from the downloads web page instead, make sure to paste the latest date
shown there—the placeholder `YYYY-MM-DD`/`2024-06-15` in this README is just an example and will
eventually be removed from Rebrickable's CDN.
