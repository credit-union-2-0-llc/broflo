"""Screenshot storage — Azure Blob with SAS URL generation.

Screenshots are stored encrypted at rest (Azure SSE). SAS tokens expire after 1 hour.
Payment entry page screenshots are NEVER captured (enforced by the agent, not here).
30-day lifecycle auto-delete is configured on the Azure container.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from ..config import AZURE_STORAGE_CONNECTION_STRING, SCREENSHOT_CONTAINER

logger = logging.getLogger("broflo-browser-agent.storage")

_store_available = False
_blob_service_client = None
_container_client = None

if AZURE_STORAGE_CONNECTION_STRING:
    try:
        from azure.storage.blob import (
            BlobServiceClient,
            generate_blob_sas,
            BlobSasPermissions,
        )

        _blob_service_client = BlobServiceClient.from_connection_string(
            AZURE_STORAGE_CONNECTION_STRING
        )
        _container_client = _blob_service_client.get_container_client(
            SCREENSHOT_CONTAINER
        )
        _store_available = True
    except Exception as e:
        logger.warning("Azure Blob Storage not available: %s", e)


class ScreenshotStore:
    """Upload screenshots to Azure Blob and generate time-limited SAS URLs."""

    async def upload(
        self,
        job_id: str,
        step_number: int,
        png_bytes: bytes,
    ) -> Optional[str]:
        """Upload a screenshot and return a 1-hour SAS URL. Returns None if storage unavailable."""
        if not _store_available or not _blob_service_client or not _container_client:
            logger.debug("Storage unavailable — skipping screenshot upload")
            return None

        from azure.storage.blob import generate_blob_sas, BlobSasPermissions

        blob_name = f"{job_id}/{step_number:02d}-{uuid.uuid4().hex[:8]}.png"

        try:
            blob_client = _container_client.get_blob_client(blob_name)
            blob_client.upload_blob(
                png_bytes,
                content_settings={"content_type": "image/png"},
                overwrite=True,
            )

            sas_token = generate_blob_sas(
                account_name=_blob_service_client.account_name,
                container_name=SCREENSHOT_CONTAINER,
                blob_name=blob_name,
                account_key=_blob_service_client.credential.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.now(timezone.utc) + timedelta(hours=1),
            )

            url = f"{blob_client.url}?{sas_token}"
            logger.info("Screenshot uploaded: %s", blob_name)
            return url

        except Exception as e:
            logger.error("Screenshot upload failed: %s", e)
            return None
