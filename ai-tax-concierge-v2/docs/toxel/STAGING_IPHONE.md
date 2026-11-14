# iPhone staging preview

## Why localhost fails on iPhone

`http://127.0.0.1:8090` is only reachable on the machine running the server. An iPhone on the same Wi‑Fi still cannot open the developer’s loopback address unless a tunnel/staging host is provided.

## Recommended secure staging (Toxel)

1. Deploy the `ai-tax-concierge-v2` backend to a **staging** host with HTTPS (Fly/Render/Cloudflare Tunnel/etc.).
2. Restrict access: IP allowlist, Basic Auth, or VPN — do **not** expose an open debug server.
3. Set CORS to the staging preview origin only.
4. Use a staging OpenAI key with low spend limits.
5. Open on iPhone Safari: `https://staging-host/widget/preview.html`

## Temporary alternatives (dev only)

- Cloudflare Tunnel / ngrok with auth in front of local 8090
- Same-LAN bind to machine LAN IP (`http://192.168.x.x:8090`) — still not production-safe

## Explicitly out of scope here

- No public unauthenticated exposure of this cloud agent’s localhost
- No deploy to live `taxsimba.co.uk` from this package
