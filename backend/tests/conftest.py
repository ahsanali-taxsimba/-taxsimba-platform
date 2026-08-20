"""Session-wide test setup.

Guarantees the dedicated QA clients exist and are tidy before any suite runs, so no suite
needs to touch the persistent demo accounts.
"""
import sys

import pytest

sys.path.insert(0, "/app/backend/tests")

from qa_clients import ensure_qa_clients, reset_qa_clients  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _qa_clients_ready():
    ensure_qa_clients()
    reset_qa_clients()
    yield
