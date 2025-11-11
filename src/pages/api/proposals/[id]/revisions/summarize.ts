import type { NextApiRequest, NextApiResponse } from "next";
import { revisionCache, CacheKeys } from "../../../../../lib/utils/cache-utils";
import { buildRevisionAnalysisPrompt } from "@/lib/prompts/summarizeRevisions";
import { stripHtml } from "@/lib/utils/htmlUtils";

// TypeScript type definitions for Discourse API
interface RevisionBodyChange {
  inline?: string;
  side_by_side?: string;
  side_by_side_markdown?: string;
}

interface RevisionTitleChange {
  inline?: string;
  previous?: string;
  current?: string;
}

interface DiscourseRevision {
  version: number;
  created_at: string;
  username: string;
  edit_reason?: string;
  body_changes?: RevisionBodyChange;
  title_changes?: RevisionTitleChange;
}

/**
 * POST /api/proposals/[id]/revisions/summarize
 *
 * Generates an AI summary of ALL REVISIONS to a proposal (topic's first post).
 * Analyzes what changed, why, and the significance of edits.
 *
 * CACHING: 15 minute TTL
 *
 * Security:
 * - Public endpoint (no auth required)
 * - Rate limited to prevent abuse
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid topic ID" });
  }

  try {
    // ===================================================================
    // CACHE CHECK
    // ===================================================================
    const cacheKey = CacheKeys.proposalRevision(id);
    const cached = revisionCache.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        ...cached,
        cached: true,
        cacheAge: Math.round((Date.now() - cached.generatedAt) / 1000),
      });
    }

    // ===================================================================
    // FETCH FROM DISCOURSE (NO AUTH)
    // ===================================================================
    const DISCOURSE_URL = process.env.DISCOURSE_URL || "https://gov.near.org";

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Get topic to find first post
    const topicResponse = await fetch(`${DISCOURSE_URL}/t/${id}.json`, {
      headers,
    });

    if (!topicResponse.ok) {
      return res.status(404).json({
        error: "Topic not found",
        status: topicResponse.status,
      });
    }

    const topicData = await topicResponse.json();
    const firstPost = topicData.post_stream?.posts?.[0];

    if (!firstPost) {
      return res.status(404).json({ error: "Post not found in topic" });
    }

    const postId = firstPost.id;
    const version = firstPost.version || 1;

    console.log(
      `[Proposal Revisions] Topic ${id} -> Post ${postId} version ${version}`
    );

    // If version is 1, no edits have been made
    if (version <= 1) {
      return res.status(200).json({
        success: true,
        summary: "This post has not been edited. No revisions to analyze.",
        topicId: id,
        postId: postId,
        author: firstPost.username,
        currentVersion: version,
        totalRevisions: 0,
        revisions: [],
        cached: false,
      });
    }

    // Fetch all revisions (they start at version 2)
    const revisions: DiscourseRevision[] = [];
    for (let i = 2; i <= version; i++) {
      try {
        const revUrl = `${DISCOURSE_URL}/posts/${postId}/revisions/${i}.json`;
        const revResponse = await fetch(revUrl, { headers });

        if (revResponse.ok) {
          const revData = await revResponse.json();
          revisions.push({
            version: revData.current_version || i,
            created_at: revData.created_at,
            username: revData.username,
            edit_reason: revData.edit_reason || "",
            body_changes: revData.body_changes,
            title_changes: revData.title_changes,
          });

          console.log(`[Proposal Revisions] Fetched revision ${i}/${version}`);
        } else {
          console.warn(
            `[Proposal Revisions] Failed to fetch revision ${i}: ${revResponse.status}`
          );
        }
      } catch (err) {
        console.error(
          `[Proposal Revisions] Error fetching revision ${i}:`,
          err
        );
        // Continue fetching other revisions
      }
    }

    if (revisions.length === 0) {
      return res.status(404).json({
        error: "Could not fetch revision data",
      });
    }

    // ===================================================================
    // PREPARE REVISION DATA FOR AI
    // ===================================================================
    // Build a comprehensive revision timeline
    const revisionTimeline = revisions
      .map((rev, index) => {
        const parts = [`**Revision ${index + 1}** (Version ${rev.version})`];
        parts.push(
          `- **Edited by:** @${rev.username} on ${new Date(
            rev.created_at
          ).toLocaleString()}`
        );

        if (rev.edit_reason) {
          parts.push(`- **Reason:** ${rev.edit_reason}`);
        }

        // Add title changes if present
        if (rev.title_changes?.previous && rev.title_changes?.current) {
          parts.push(`- **Title Changed:**`);
          parts.push(`  - FROM: "${rev.title_changes.previous}"`);
          parts.push(`  - TO: "${rev.title_changes.current}"`);
        }

        // Add body changes
        if (rev.body_changes?.inline) {
          // Try to use side-by-side markdown first (clearer before/after)
          if (rev.body_changes.side_by_side_markdown) {
            const cleanDiff = stripHtml(rev.body_changes.side_by_side_markdown);
            const truncatedDiff =
              cleanDiff.length > 1500
                ? cleanDiff.substring(0, 1500) + "\n[... diff truncated ...]"
                : cleanDiff;
            parts.push(
              `- **Content Changes (Before/After):**\n${truncatedDiff}`
            );
          } else if (rev.body_changes.side_by_side) {
            const cleanDiff = stripHtml(rev.body_changes.side_by_side);
            const truncatedDiff =
              cleanDiff.length > 1500
                ? cleanDiff.substring(0, 1500) + "\n[... diff truncated ...]"
                : cleanDiff;
            parts.push(
              `- **Content Changes (Before/After):**\n${truncatedDiff}`
            );
          } else {
            // Fallback to inline diff
            const cleanDiff = stripHtml(rev.body_changes.inline);
            const truncatedDiff =
              cleanDiff.length > 1000
                ? cleanDiff.substring(0, 1000) + "\n[... diff truncated ...]"
                : cleanDiff;
            parts.push(`- **Content Changes:**\n${truncatedDiff}`);
          }
        }

        return parts.join("\n");
      })
      .join("\n\n---\n\n");

    // Truncate if needed
    const MAX_LENGTH = 10000;
    const truncatedTimeline =
      revisionTimeline.length > MAX_LENGTH
        ? revisionTimeline.substring(0, MAX_LENGTH) +
          "\n\n[... additional revisions truncated ...]"
        : revisionTimeline;

    // ===================================================================
    // GENERATE AI SUMMARY USING PROMPT BUILDER
    // ===================================================================
    const apiKey = process.env.NEAR_AI_CLOUD_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "AI API not configured" });
    }

    // Use the prompt builder function
    const prompt = buildRevisionAnalysisPrompt(
      postId.toString(),
      { username: firstPost.username },
      revisions,
      version,
      truncatedTimeline
    );

    const summaryResponse = await fetch(
      "https://cloud-api.near.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-ai/DeepSeek-V3.1",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 800,
        }),
      }
    );

    if (!summaryResponse.ok) {
      throw new Error(`AI summary failed: ${summaryResponse.status}`);
    }

    const data = await summaryResponse.json();
    const summary: string = data.choices[0]?.message?.content ?? "";

    if (!summary) {
      throw new Error("Empty summary returned from AI");
    }

    // ===================================================================
    // BUILD RESPONSE
    // ===================================================================
    const response = {
      success: true,
      summary,
      topicId: id,
      postId: postId,
      author: firstPost.username,
      currentVersion: version,
      totalRevisions: revisions.length,
      revisions: revisions.map((rev) => ({
        version: rev.version,
        editedBy: rev.username,
        editedAt: rev.created_at,
        editReason: rev.edit_reason || null,
        hasTitleChange: !!(
          rev.title_changes?.previous && rev.title_changes?.current
        ),
        hasBodyChange: !!rev.body_changes?.inline,
      })),
      truncated: revisionTimeline.length > MAX_LENGTH,
      generatedAt: Date.now(),
      cached: false,
    };

    // ===================================================================
    // STORE IN CACHE (15 minute TTL)
    // ===================================================================
    revisionCache.set(cacheKey, response);

    return res.status(200).json(response);
  } catch (error: any) {
    console.error("[Proposal Revisions] Error:", error);
    return res.status(500).json({
      error: "Failed to generate revision summary",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
