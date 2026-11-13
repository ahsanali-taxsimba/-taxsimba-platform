# Dynamic HMRC Knowledge System

## Purpose

Monitor official GOV.UK / HMRC sources, detect changes, deterministically verify high-impact facts, publish only safe updates, quarantine ambiguous/high-impact/consultation content, and keep historical versions with rollback — **without** prompt rewrites or app redeploy for knowledge publication.

## Components

| Module | Role |
|--------|------|
| `data/knowledge/registry/source_registry.json` | Versioned source registry |
| `src/knowledge/dynamic/monitor.ts` | Fetch + change detection |
| `src/knowledge/dynamic/validators.ts` | Deterministic MTD/VAT/integrity checks |
| `src/knowledge/dynamic/publish.ts` | Publish + rollback |
| `src/knowledge/dynamic/scheduler.ts` | Critical/daily interval scheduler |
| `src/knowledge/loader.ts` | Merges curated + active published facts |

## Legal-status discipline

Never auto-publish consultations, draft legislation, or announcements as enacted rules. Withdrawn guidance is quarantined for human review. LLM cannot declare new legal rules as verified facts.

## Proof

See `evidence/dynamic_hmrc_knowledge_proof.json` — controlled fixture run covering detect → verify/quarantine → publish → answer grounding → historical retention → failed verification → alerts → rollback.
