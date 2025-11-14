#!/usr/bin/env python3
"""Locate the directory that hosts the latest Rebrickable CSV export."""
from __future__ import annotations

import os
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Iterable, List

DEFAULT_INDEX = "https://rebrickable.com/downloads/"
DEFAULT_SAMPLES = (
    "colors.csv.gz",
    "parts.csv.gz",
    "sets.csv.gz",
)
USER_AGENT = os.environ.get(
    "REBRICKABLE_DOWNLOAD_UA", "Aim2Build Catalog Importer/1.0"
)


class _LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: List[str] = []

    def handle_starttag(self, tag: str, attrs: Iterable[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        for name, value in attrs:
            if name.lower() == "href" and value:
                self.links.append(value)


def _iter_sample_links(links: Iterable[str], samples: Iterable[str]) -> Iterable[str]:
    for link in links:
        for sample in samples:
            if sample in link:
                yield link
                break


def _normalize_url(index_url: str, href: str) -> str:
    absolute = urllib.parse.urljoin(index_url, href)
    parts = urllib.parse.urlsplit(absolute)
    scheme = parts.scheme or urllib.parse.urlsplit(index_url).scheme or "https"
    netloc = parts.netloc or urllib.parse.urlsplit(index_url).netloc
    normalized = urllib.parse.urlunsplit((scheme, netloc, parts.path, parts.query, ""))
    return normalized


def main() -> int:
    index_url = os.environ.get("REBRICKABLE_DOWNLOAD_INDEX", DEFAULT_INDEX)
    raw_samples = os.environ.get("REBRICKABLE_EXPORT_FILES")
    samples = tuple(
        filter(None, [segment.strip() for segment in raw_samples.split(",")])
    ) if raw_samples else DEFAULT_SAMPLES

    request = urllib.request.Request(index_url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8", "replace")
    except Exception as exc:  # pragma: no cover - network issues are surfaced to shell script
        print(f"Failed to download {index_url}: {exc}", file=sys.stderr)
        return 1

    parser = _LinkCollector()
    parser.feed(body)
    for href in _iter_sample_links(parser.links, samples):
        normalized = _normalize_url(index_url, href)
        parts = urllib.parse.urlsplit(normalized)
        if not parts.path or "/" not in parts.path:
            continue
        base_path = parts.path.rsplit("/", 1)[0]
        if not base_path:
            continue
        base = urllib.parse.urlunsplit((parts.scheme, parts.netloc, base_path, "", ""))
        print(base.rstrip("/"))
        return 0

    print(
        "Could not locate a CSV download link on the Rebrickable downloads page.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
