"""
Migration: Create durable Initiative for every assessment lacking initiative_id.

D-C — Legacy Migration:
- One durable Initiative per assessment — no name-based grouping.
- Preserves embedded initiative snapshot.
- Idempotent: safe to run multiple times.

Usage:
    cd backend
    python scripts/migrate_initiatives.py
"""
from __future__ import annotations
import asyncio
import os
import sys
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def migrate() -> None:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    logger.info("Scanning assessments for missing initiative_id …")

    cursor = db.assessments.find(
        {"initiative_id": {"$exists": False}},
        {"_id": 0},
    )
    assessments = await cursor.to_list(length=10_000)

    migrated = 0
    skipped = 0

    for doc in assessments:
        assessment_id = doc.get("id")
        if not assessment_id:
            logger.warning("Assessment document missing 'id' field — skipping.")
            skipped += 1
            continue

        # Double-check initiative_id hasn't been set by a concurrent operation
        fresh = await db.assessments.find_one({"id": assessment_id}, {"_id": 0, "initiative_id": 1})
        if fresh and fresh.get("initiative_id"):
            skipped += 1
            continue

        emb = doc.get("initiative", {})
        initiative_doc = {
            "id": str(uuid.uuid4()),
            "name": emb.get("name", ""),
            "business_unit": emb.get("business_unit", ""),
            "description": emb.get("description", ""),
            "target_workflow": emb.get("target_workflow", ""),
            "expected_outcomes": emb.get("expected_outcomes", ""),
            "stage": emb.get("stage"),
            "created_at": doc.get("created_at", _now_iso()),
            "updated_at": _now_iso(),
        }

        # Insert initiative (skip if already exists with same id — shouldn't happen)
        await db.initiatives.insert_one(initiative_doc)

        await db.assessments.update_one(
            {"id": assessment_id},
            {"$set": {"initiative_id": initiative_doc["id"]}},
        )

        logger.info(
            "Migrated assessment %s → initiative %s (%s)",
            assessment_id,
            initiative_doc["id"],
            emb.get("name", "<unnamed>"),
        )
        migrated += 1

    client.close()
    logger.info(
        "Migration complete. Migrated: %d  Skipped (already had initiative_id): %d",
        migrated,
        skipped,
    )


if __name__ == "__main__":
    asyncio.run(migrate())
