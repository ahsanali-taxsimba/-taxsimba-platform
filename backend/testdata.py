"""Separation of automated-test records from genuine operational records.

Test suites create throwaway clients with recognisable addresses. Their cases stay in the
database (nothing is deleted, audit history is preserved) but are flagged so they never appear
in operational accountant/admin queues, counts, deadlines or searches.
"""

TEST_EMAIL_PREFIXES = ("test_", "ux_test_", "qa.")
TEST_EMAIL_DOMAINS = ("qa-taxsimba.example.com",)
# Manual demo accounts are genuine operational records and must never be flagged.
GENUINE_EMAILS = ("clienta@example.com", "clientb@example.com")

# Reused by every operational query so one rule governs all of them.
OPERATIONAL_ONLY = {"is_test": {"$ne": True}}

# Mongo regex matching the automated-test address patterns above.
TEST_EMAIL_REGEX = r"^(test_|ux_test_|qa\.)|@qa-taxsimba\.example\.com$"


def is_test_email(email: str | None) -> bool:
    if not email:
        return False
    email = email.lower()
    if email in GENUINE_EMAILS:
        return False
    return email.startswith(TEST_EMAIL_PREFIXES) or email.endswith(TEST_EMAIL_DOMAINS)
