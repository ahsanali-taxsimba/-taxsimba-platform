# Architecture diagrams (text)

## Tenancy

```
User ──owns──► Account ──has──► Subscription ──► Plan
                 │
                 ├── UsageRecord (monthly meters)
                 ├── ApiKey
                 └── Workspace(s)
                        │
                        ├── WorkspaceMember (role)
                        └── Site(s)
                               ├── Keyword → RankRecord / SERPFeature
                               ├── Crawl → CrawlIssue / Page
                               ├── Backlink / ContentPage / AIJob
                               └── AIVisibilityRecord → AICitation
```

## Request path

```
Browser → Next.js route handler → Auth (JWT cookie)
        → Tenant guard (workspace membership)
        → Usage assert / increment
        → Domain service
        → Prisma  |  enqueue BullMQ job
```

## AEO / GEO pipeline

```
Prompts + brand/domain
    → aeo-scan queue
    → per AIEngine provider adapter
    → AIVisibilityRecord + AICitation rows
    → share-of-voice aggregate in API/UI
    → (future) alert rules on drop / competitor gain
```
