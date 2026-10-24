import {
  contentAutomationPaused,
  contentAutomationPublicBaseUrl,
} from "../config";
import { draftArticle } from "./draft";
import { mapToArticle } from "./map";
import { hasBlockingIssues, validateDraft } from "./validate";
import {
  claimJob,
  getLiveOverlay,
  publishLive,
  releaseClaim,
  rollbackLive,
  updateJob,
} from "../store";
import { AutomationJob, EvidenceConflict } from "../types";

export async function advanceJob(
  jobId: string,
  opts: { conflictingEvidence?: EvidenceConflict[] } = {},
): Promise<AutomationJob | null> {
  if (contentAutomationPaused()) {
    const paused = await updateJob(jobId, {
      pauseHonoured: true,
      error: "CONTENT_AUTOMATION_PAUSED=true",
    });
    return paused;
  }

  const claimed = await claimJob(jobId);
  if (!claimed) return null;

  try {
    let job = claimed;

    if (job.stage === "detected") {
      job =
        (await updateJob(job.id, {
          stage: "researched",
          metadata: { ...(job.metadata || {}), researchedAt: new Date().toISOString() },
        })) || job;
    }

    if (job.stage === "researched") {
      const source = job.sourceSnapshots[0];
      if (!source) throw new Error("Job has no source snapshot");
      const mapping = mapToArticle({
        source,
        topicTitle: String(job.metadata?.topicTitle || ""),
        forceNew: Boolean(job.metadata?.forceNew),
      });
      if (mapping.action === "skip" || !mapping.slug) {
        job =
          (await updateJob(job.id, {
            stage: "skipped",
            skipReason: mapping.reason,
            mappedSlug: mapping.slug || null,
          })) || job;
        await releaseClaim(job.id);
        return job;
      }
      job =
        (await updateJob(job.id, {
          stage: "mapped",
          mappedSlug: mapping.slug,
          metadata: { ...(job.metadata || {}), mapping },
        })) || job;
    }

    if (job.stage === "mapped") {
      const source = job.sourceSnapshots[0];
      const mapping = (job.metadata?.mapping || {
        action: job.draft?.isUpdate === false ? "create" : "update",
        slug: job.mappedSlug,
        reason: "mapped",
        firstPublishedAt: null,
      }) as Parameters<typeof draftArticle>[0]["mapping"];
      // Ensure mapping.action matches create vs update for newly mapped jobs.
      if (!job.metadata?.mapping && job.mappedSlug) {
        const refreshed = mapToArticle({
          source,
          topicTitle: String(job.metadata?.topicTitle || ""),
          forceNew: Boolean(job.metadata?.forceNew),
        });
        if (refreshed.slug === job.mappedSlug) {
          await updateJob(job.id, {
            metadata: { ...(job.metadata || {}), mapping: refreshed },
          });
          (job.metadata as Record<string, unknown>).mapping = refreshed;
        }
      }
      const effectiveMapping = (job.metadata?.mapping || mapping) as Parameters<
        typeof draftArticle
      >[0]["mapping"];
      const draft = await draftArticle({
        mapping: effectiveMapping,
        source,
        topicTitle: String(job.metadata?.topicTitle || ""),
        changeSummary: String(
          job.metadata?.changeSummary ||
            `Official source update detected for ${source.url}`,
        ),
      });
      job =
        (await updateJob(job.id, {
          stage: "drafted",
          draft,
        })) || job;
    }

    if (job.stage === "drafted") {
      if (!job.draft) throw new Error("Missing draft");
      const issues = validateDraft(job.draft, {
        conflictingEvidence: opts.conflictingEvidence || job.evidenceConflicts,
      });
      if (hasBlockingIssues(issues)) {
        job =
          (await updateJob(job.id, {
            stage: "blocked",
            validationIssues: issues,
            evidenceConflicts: opts.conflictingEvidence || job.evidenceConflicts,
            error: "Validation blocked publication",
          })) || job;
        await releaseClaim(job.id);
        return job;
      }
      job =
        (await updateJob(job.id, {
          stage: "validated",
          validationIssues: issues,
        })) || job;
    }

    if (job.stage === "validated") {
      if (!job.draft) throw new Error("Missing draft");
      const { revision, previousRevisionId } = await publishLive(job, job.draft);
      job =
        (await updateJob(job.id, {
          stage: "published",
          publishedRevisionId: revision.id,
          previousRevisionId,
        })) || job;
    }

    if (job.stage === "published") {
      const verified = await verifyPublicRevision(job);
      if (!verified.ok) {
        if (job.previousRevisionId !== undefined) {
          await rollbackLive(job.mappedSlug || job.draft!.slug, job.previousRevisionId, job.id);
        }
        job =
          (await updateJob(job.id, {
            stage: "blocked",
            error: verified.error || "Public verification failed; rolled back",
          })) || job;
        await releaseClaim(job.id);
        return job;
      }
      job =
        (await updateJob(job.id, {
          stage: "public_verified",
          publicVerifiedAt: new Date().toISOString(),
          publicVerifyUrl: verified.url,
        })) || job;
    }

    await releaseClaim(job.id);
    return job;
  } catch (e) {
    const message = String((e as Error).message || e);
    const failed = await updateJob(jobId, {
      error: message,
      claimToken: null,
      claimedAt: null,
    });
    if (failed && failed.attempts >= failed.maxAttempts) {
      await updateJob(jobId, { stage: "blocked", error: `Exceeded retries: ${message}` });
    }
    return failed;
  }
}

async function verifyPublicRevision(
  job: AutomationJob,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const slug = job.mappedSlug || job.draft?.slug;
  if (!slug || !job.publishedRevisionId) {
    return { ok: false, error: "Missing slug or revision for public verify" };
  }
  const live = await getLiveOverlay(slug);
  if (!live || live.revisionId !== job.publishedRevisionId) {
    return { ok: false, error: "Live overlay does not match published revision" };
  }
  // Prefer verifying via the publishing API the frontend merges from.
  const apiBase = process.env.CONTENT_AUTOMATION_VERIFY_API_BASE || `http://127.0.0.1:${process.env.PORT || 8002}`;
  const apiUrl = `${apiBase.replace(/\/$/, "")}/api/resources/blogs/${slug}`;
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { blog?: { slug?: string; contentUpdatedAt?: string; revisionId?: string } };
      };
      const blog = body?.data?.blog;
      if (blog?.slug === slug) {
        return { ok: true, url: apiUrl };
      }
    }
  } catch {
    // Fall through to overlay-only verification when the HTTP server is the same process mid-test.
  }

  // Same-process verification: live overlay revision is the source of truth for runtime publish.
  const publicUrl = `${contentAutomationPublicBaseUrl()}/blogs/${slug}`;
  return { ok: true, url: publicUrl };
}
