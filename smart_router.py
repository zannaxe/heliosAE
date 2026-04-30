"""
smart_router.py
---------------
Intelligent auto-router for openclaude.

Instead of always using one fixed provider, the smart router:
- Pings all configured providers on startup
- Scores them by latency, cost, and health
- Routes each request to the optimal provider
- Falls back automatically if a provider fails
- Learns from real request timings over time

Usage in server.py:
    from smart_router import SmartRouter
    router = SmartRouter()
    await router.initialize()
    result = await router.route(messages, model, stream)

.env config:
    ROUTER_MODE=smart          # or: fixed (default behaviour)
    ROUTER_STRATEGY=latency    # or: cost, balanced
    ROUTER_FALLBACK=true       # auto-retry on failure

Contribution to: https://aeris-nexus.dev
"""

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

# ── Provider definitions ──────────────────────────────────────────────────────

@dataclass
class Provider:
    name: str                        # e.g. "groq", "gemini", "openai", "ollama"
    ping_url: str                    # URL used to check health
    api_key_env: str                 # env var name for API key
    cost_per_1k_tokens: float        # estimated cost USD per 1k tokens
    big_model: str                   # model for sonnet/large requests
    small_model: str                 # model for haiku/small requests
    latency_ms: float = 9999.0       # updated by benchmark
    healthy: bool = True             # updated by health checks
    request_count: int = 0           # total requests routed here
    error_count: int = 0             # total errors from this provider
    avg_latency_ms: float = 9999.0   # rolling average from real requests

    @property
    def api_key(self) -> Optional[str]:
        return os.getenv(self.api_key_env) if self.api_key_env else None

    @property
    def is_configured(self) -> bool:
        """True if the provider has an API key set."""
        if self.name == "ollama":
            return True  # Ollama needs no API key
        return bool(self.api_key)

    @property
    def error_rate(self) -> float:
        if self.request_count == 0:
            return 0.0
        return self.error_count / self.request_count

    def score(self, strategy: str = "balanced") -> float:
        """
        Lower score = better provider.
        strategy: 'latency' | 'cost' | 'balanced'
        """
        if not self.healthy or not self.is_configured:
            return float("inf")

        latency_score = self.avg_latency_ms / 1000.0   # normalize to seconds
        cost_score = self.cost_per_1k_tokens * 100      # normalize to similar scale
        error_penalty = self.error_rate * 500           # heavy penalty for errors

        if strategy == "latency":
            return latency_score + error_penalty
        elif strategy == "cost":
            return cost_score + error_penalty
        else:  # balanced
            return (latency_score * 0.5) + (cost_score * 0.5) + error_penalty


# ── Default provider catalogue ────────────────────────────────────────────────

def build_default_providers() -> list[Provider]:
    big = os.getenv("BIG_MODEL", "gemini-2.5-flash-preview-04-17")
    small = os.getenv("SMALL_MODEL", "llama-3.3-70b-versatile")
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    return [
        # Fix: Groq ditambahkan — provider utama untuk query cepat di HeliosAE
        Provider(
            name="groq",
            ping_url="https://api.groq.com/openai/v1/models",
            api_key_env="GROQ_API_KEY",
            cost_per_1k_tokens=0.0,   # free tier
            big_model="llama-3.3-70b-versatile",
            small_model="llama-3.1-8b-instant",
        ),
        # Gemini 2.5 Pro — terbaik untuk long context & reasoning
        Provider(
            name="gemini",
            ping_url="https://generativelanguage.googleapis.com/v1/models",
            api_key_env="GEMINI_API_KEY",
            cost_per_1k_tokens=0.0,   # free tier (exp model)
            big_model="gemini-2.5-flash-preview-04-17",
            small_model="gemini-2.0-flash-lite",
        ),
        # Ollama — local, gratis, no API key
        Provider(
            name="ollama",
            ping_url=f"{ollama_url}/api/tags",
            api_key_env="",
            cost_per_1k_tokens=0.0,   # free — local
            big_model=big if "gemini" not in big and "gpt" not in big and "llama" not in big else "llama3:8b",
            small_model=small if "gemini" not in small and "gpt" not in small and "llama" not in small else "llama3:8b",
        ),
        # OpenAI — fallback berbayar kalau diperlukan
        Provider(
            name="openai",
            ping_url="https://api.openai.com/v1/models",
            api_key_env="OPENAI_API_KEY",
            cost_per_1k_tokens=0.002,
            big_model=big if "gpt" in big else "gpt-4.1",
            small_model=small if "gpt" in small else "gpt-4.1-mini",
        ),
    ]


# ── Smart Router ──────────────────────────────────────────────────────────────

class SmartRouter:
    """
    Intelligently routes HeliosAE API requests to the best
    available LLM provider based on latency, cost, and health.

    Default priority (free tier):
      1. Groq  — fastest real-time response
      2. Gemini 2.5 Pro — best reasoning, 1M context
      3. Ollama — local fallback
    """

    def __init__(
        self,
        providers: Optional[list[Provider]] = None,
        strategy: Optional[str] = None,
        fallback_enabled: Optional[bool] = None,
    ):
        self.providers = providers or build_default_providers()
        self.strategy = strategy or os.getenv("ROUTER_STRATEGY", "balanced")
        self.fallback_enabled = (
            fallback_enabled
            if fallback_enabled is not None
            else os.getenv("ROUTER_FALLBACK", "true").lower() == "true"
        )
        self._initialized = False

    # ── Initialization ────────────────────────────────────────────────────────

    async def initialize(self) -> None:
        """Ping all providers and build initial latency scores."""
        logger.info("SmartRouter: benchmarking providers...")
        await asyncio.gather(
            *[self._ping_provider(p) for p in self.providers],
            return_exceptions=True,
        )
        available = [p for p in self.providers if p.healthy and p.is_configured]
        logger.info(
            f"SmartRouter ready. Available providers: "
            f"{[p.name for p in available]}"
        )
        if not available:
            logger.warning(
                "SmartRouter: no providers available! "
                "Check your API keys in .env"
            )
        self._initialized = True

    async def _ping_provider(self, provider: Provider) -> None:
        """Measure latency to a provider's health endpoint."""
        if not provider.is_configured:
            provider.healthy = False
            logger.debug(f"SmartRouter: {provider.name} skipped — no API key")
            return

        headers = {}
        if provider.api_key:
            headers["Authorization"] = f"Bearer {provider.api_key}"

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(provider.ping_url, headers=headers)
                # 200 or 401 (key works but not authorized for models list) = online
                provider.healthy = resp.status_code in (200, 401, 403)
        except Exception as e:
            provider.healthy = False
            logger.debug(f"SmartRouter: {provider.name} ping failed: {e}")
            return

        elapsed_ms = (time.monotonic() - start) * 1000
        provider.latency_ms = elapsed_ms
        provider.avg_latency_ms = elapsed_ms
        logger.debug(
            f"SmartRouter: {provider.name} healthy={provider.healthy} "
            f"latency={elapsed_ms:.0f}ms"
        )

    # ── Routing ───────────────────────────────────────────────────────────────

    def _select_provider(self, context_tokens: int = 0, force_big: bool = False) -> Optional[Provider]:
        """
        Pick the best available provider.

        HeliosAE routing logic:
          - context > 50k tokens → Gemini 2.5 Pro (1M context window)
          - otherwise            → Groq (fastest free tier)
          - fallback             → next best available
        """
        if not self._initialized:
            raise RuntimeError("SmartRouter.initialize() must be called first")

        available = [p for p in self.providers if p.healthy and p.is_configured]
        if not available:
            return None

        # HeliosAE smart routing: context-aware
        if context_tokens > 50_000:
            # Long context → prefer Gemini 2.5 Pro
            gemini = next((p for p in available if p.name == "gemini"), None)
            if gemini:
                return gemini
        else:
            # Short/medium context → prefer Groq for speed
            groq = next((p for p in available if p.name == "groq"), None)
            if groq:
                return groq

        # Fallback: score-based selection
        return min(available, key=lambda p: p.score(self.strategy))

    def _resolve_model(self, provider: Provider, model: Optional[str], force_big: bool) -> str:
        """Resolve which model to use for this provider."""
        if model:
            return model
        return provider.big_model if force_big else provider.small_model

    async def route(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        stream: bool = False,
        force_big: bool = False,
        context_tokens: int = 0,
    ) -> dict:
        """
        Route a completion request to the best available provider.
        Returns the raw API response dict.
        """
        provider = self._select_provider(context_tokens=context_tokens, force_big=force_big)
        if not provider:
            raise RuntimeError("No healthy providers available")

        resolved_model = self._resolve_model(provider, model, force_big)

        try:
            result = await self._call_provider(provider, messages, resolved_model, stream)
            provider.request_count += 1
            return result
        except Exception as e:
            provider.error_count += 1
            provider.request_count += 1
            logger.warning(f"SmartRouter: {provider.name} failed: {e}")

            if self.fallback_enabled:
                return await self._fallback(provider, messages, resolved_model, stream, context_tokens)
            raise

    async def _fallback(
        self,
        failed: Provider,
        messages: list[dict],
        model: Optional[str],
        stream: bool,
        context_tokens: int,
    ) -> dict:
        """Try remaining providers after a failure."""
        available = [
            p for p in self.providers
            if p.healthy and p.is_configured and p.name != failed.name
        ]
        for provider in sorted(available, key=lambda p: p.score(self.strategy)):
            resolved_model = self._resolve_model(provider, model, force_big=False)
            try:
                result = await self._call_provider(provider, messages, resolved_model, stream)
                provider.request_count += 1
                logger.info(f"SmartRouter: fallback to {provider.name} successful")
                return result
            except Exception as e:
                provider.error_count += 1
                provider.request_count += 1
                logger.warning(f"SmartRouter: fallback {provider.name} also failed: {e}")
        raise RuntimeError("All providers failed")

    async def _call_provider(
        self,
        provider: Provider,
        messages: list[dict],
        model: str,
        stream: bool,
    ) -> dict:
        """
        Make the actual API call using OpenAI-compatible chat completions endpoint.
        Both Groq and Gemini support this format natively.
        """
        if provider.name == "ollama":
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            api_url = f"{base_url}/v1/chat/completions"
            headers = {"Content-Type": "application/json"}
        elif provider.name == "gemini":
            api_url = f"{PROVIDER_URLS_PY['gemini']}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {provider.api_key}",
            }
        else:
            # OpenAI-compatible (groq, openai, etc.)
            api_url = f"{PROVIDER_URLS_PY.get(provider.name, 'https://api.openai.com/v1')}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {provider.api_key}",
            }

        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }

        start = time.monotonic()
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(api_url, json=payload, headers=headers)
            resp.raise_for_status()

        elapsed_ms = (time.monotonic() - start) * 1000
        # Update rolling average latency
        alpha = 0.2
        provider.avg_latency_ms = (
            alpha * elapsed_ms + (1 - alpha) * provider.avg_latency_ms
        )

        return resp.json()

    def status(self) -> dict:
        """Return router status for diagnostics."""
        return {
            "strategy": self.strategy,
            "fallback_enabled": self.fallback_enabled,
            "providers": [
                {
                    "name": p.name,
                    "healthy": p.healthy,
                    "configured": p.is_configured,
                    "latency_ms": round(p.avg_latency_ms, 1),
                    "requests": p.request_count,
                    "errors": p.error_count,
                    "error_rate": round(p.error_rate * 100, 1),
                    "score": round(p.score(self.strategy), 3),
                }
                for p in self.providers
            ],
        }


# ── Provider URL map ──────────────────────────────────────────────────────────

PROVIDER_URLS_PY: dict[str, str] = {
    "groq":   "https://api.groq.com/openai/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "openai": "https://api.openai.com/v1",
}


# ── CLI entrypoint ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    async def main() -> None:
        logging.basicConfig(level=logging.INFO)
        router = SmartRouter()
        await router.initialize()
        print(json.dumps(router.status(), indent=2))

    asyncio.run(main())
