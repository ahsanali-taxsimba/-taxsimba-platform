from app.core.privacy import privacy_flags, redact_pii


def test_redact_email_and_ni():
    text = "Contact me at jane.doe@example.com NI QQ123456C please"
    redacted = redact_pii(text)
    assert "jane.doe@example.com" not in redacted
    assert "[REDACTED_EMAIL]" in redacted
    assert "QQ123456C" not in redacted
    assert "[REDACTED_NI]" in redacted


def test_redact_utr_and_phone():
    text = "UTR 1234567890 phone 07123 456789"
    redacted = redact_pii(text)
    assert "1234567890" not in redacted
    assert "[REDACTED_UTR]" in redacted
    assert "[REDACTED_PHONE]" in redacted


def test_privacy_flags():
    flags = privacy_flags("email test@example.com")
    assert flags["email"] is True
    assert flags["ni"] is False
