"""Earth Engine authentication.

Prefers Application Default Credentials over a downloaded service-account key.
The example.org organisation enforces
`iam.managed.disableServiceAccountKeyCreation`, so no key can be created for a
project in that org — and that policy is worth keeping. ADC needs no key file
and nothing secret ever lands on disk in the repo.

A key path is still honoured when one is present, for deployment environments
outside that org where a key is the only option.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

log = logging.getLogger(__name__)

ADC_PATH = Path.home() / ".config" / "gcloud" / "application_default_credentials.json"


class EarthEngineNotConfigured(RuntimeError):
    """Raised with the exact command needed, rather than a stack trace from deep in ee."""


def _project_id() -> str:
    project = os.getenv("GEE_PROJECT_ID", "").strip()
    if not project:
        raise EarthEngineNotConfigured(
            "GEE_PROJECT_ID is not set. Copy .env.example to .env and set it."
        )
    return project


def _registration_error(project: str, err: Exception) -> Exception:
    """Enabling the API and registering the project are separate steps, and only the
    second is a web form. `ee.Initialize` fetches the algorithm list, so an
    unregistered project fails there rather than on the first real computation."""
    if "not registered" not in str(err):
        return err
    return EarthEngineNotConfigured(
        f"{project} is authenticated but not registered with Earth Engine.\n"
        "  Register it at:\n"
        f"  https://console.cloud.google.com/earth-engine/configuration?project={project}\n"
        "  Enabling earthengine.googleapis.com is not sufficient on its own."
    )


def initialize(project: str | None = None) -> None:
    """Initialise the Earth Engine client, by key if configured, else by ADC."""
    import ee

    project = project or _project_id()
    # google.auth warns "No project ID could be determined" when it resolves
    # credentials without one, even though ee.Initialize is given the project.
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", project)
    key_path = os.getenv("GEE_PRIVATE_KEY_PATH", "").strip()

    if key_path and Path(key_path).is_file():
        service_account = os.getenv("GEE_SERVICE_ACCOUNT", "").strip()
        if not service_account:
            raise EarthEngineNotConfigured(
                "GEE_PRIVATE_KEY_PATH is set but GEE_SERVICE_ACCOUNT is not."
            )
        credentials = ee.ServiceAccountCredentials(service_account, key_path)
        try:
            ee.Initialize(credentials, project=project)
        except ee.EEException as e:
            raise _registration_error(project, e) from e
        log.info("Earth Engine initialised for %s via service-account key", project)
        return

    if not ADC_PATH.is_file():
        raise EarthEngineNotConfigured(
            "No Earth Engine credentials found.\n"
            "  Run:  gcloud auth application-default login\n"
            f"  This writes {ADC_PATH} and needs a browser.\n"
            "  A service-account key is the alternative, but the org policy\n"
            "  iam.managed.disableServiceAccountKeyCreation forbids creating one."
        )

    try:
        ee.Initialize(project=project)
    except ee.EEException as e:
        raise _registration_error(project, e) from e
    log.info("Earth Engine initialised for %s via application default credentials", project)


def check() -> dict[str, object]:
    """Round-trip a trivial computation to prove the credentials actually work.

    Initialising succeeds against a project that was never registered with Earth
    Engine; only a real call fails, so the check has to compute something.
    """
    import ee

    initialize()
    value = ee.Number(1).add(1).getInfo()
    bands = ee.Image("USGS/SRTMGL1_003").bandNames().getInfo()
    if value != 2:
        raise EarthEngineNotConfigured(f"Earth Engine returned {value!r}, expected 2")
    return {"arithmetic_ok": True, "srtm_bands": bands}
