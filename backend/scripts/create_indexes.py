#!/usr/bin/env python3
"""
Standalone MongoDB index creation script for the Decision Intelligence Engine.

Indexes are also created idempotently at backend startup (see server.py
`ensure_indexes`). Run this script explicitly when:
  - Deploying for the first time against a fresh database
  - Migrating to a new MongoDB cluster
  - Verifying / repairing index state during ops incidents

Usage:
    cd /app/backend
    python scripts/create_indexes.py

Required environment:
    MONGO_URL   e.g. mongodb://localhost:27017
    DB_NAME     e.g. die_database
"""
from __future__ import annotations
import asyncio
import os
import sys
from pathlib import Path

# Allow running this script directly: load the backend .env if present
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient


INDEX_DEFINITIONS = [
    # (collection, keys, kwargs)
    ("assessments", "id", {"unique": True, "name": "assessments_id_unique"}),
    ("reports",     "assessment_id", {"name": "reports_assessment_id"}),
    ("share_links", "token", {"unique": True, "name": "share_links_token_unique"}),
    (
        "share_links",
        [("assessment_id", 1), ("is_active", 1)],
        {"name": "share_links_assessment_id_is_active"},
    ),
]


async def main() -> int:
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL and DB_NAME must be set in the environment.", file=sys.stderr)
        return 2

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"Creating indexes on {db_name} @ {mongo_url} ...")
    for collection_name, keys, kwargs in INDEX_DEFINITIONS:
        collection = db[collection_name]
        result = await collection.create_index(keys, **kwargs)
        print(f"  ✓ {collection_name}.{kwargs.get('name', result)}")

    print("All indexes verified.")
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
