from app.adapters.factory import build_llm_adapter, build_stub_adapters
from app.adapters.llm_mock import MockLLMAdapter
from app.core.config import Settings


def test_force_mock_llm_even_with_key():
    settings = Settings(OPENAI_API_KEY="sk-test-key", CONCIERGE_FORCE_MOCK_LLM=True)
    adapter = build_llm_adapter(settings)
    assert isinstance(adapter, MockLLMAdapter)
    assert adapter.mode == "mock"


def test_stub_adapters_phase1():
    settings = Settings(
        WEBSITE_BASE_URL="https://www.taxsimba.com",
        CONSULTATION_BOOKING_URL="https://calendly.com/example/taxsimba-99-consultation",
    )
    stubs = build_stub_adapters(settings)
    nav = stubs["website"].suggest_paths("self_assessment")
    assert nav[0]["url"].startswith("https://www.taxsimba.com")
    assert stubs["payment"].create_checkout("SA_SMART")["status"] == "unavailable"
    cal = stubs["calendly"].consultation_link(99)
    assert cal["price_gbp"] == 99
    assert "calendly.com" in cal["booking_url"]
    assert stubs["client_portal"].account_status(None)["status"] == "unavailable"


def test_openai_adapter_requires_key():
    from app.adapters.llm_openai import OpenAIAdapter
    import pytest

    with pytest.raises(ValueError):
        OpenAIAdapter(api_key="", model="gpt-4o-mini")
