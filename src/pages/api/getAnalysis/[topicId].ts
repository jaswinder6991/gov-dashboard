import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { screeningResults } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/getAnalysis/[topicId]
 *
 * Fetches screening results for a specific Discourse topic.
 * Now supports querying specific revisions or getting the latest.
 *
 * Query Parameters:
 * - revisionNumber (optional): Get screening for a specific revision
 * - all (optional): If "true", returns all revisions for the topic
 *
 * Examples:
 * - GET /api/getAnalysis/123 → Returns latest screening
 * - GET /api/getAnalysis/123?revisionNumber=2 → Returns screening for revision 2
 * - GET /api/getAnalysis/123?all=true → Returns all screenings for this topic
 *
 * Public endpoint - no authentication required.
 * Used to display screening badges on proposal pages.
 *
 * Returns:
 * - 200: Screening results found
 * - 404: No screening exists for this topic/revision
 * - 400: Invalid topic ID or revision number
 * - 405: Method not allowed (non-GET requests)
 * - 500: Database error
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "This endpoint only supports GET requests",
    });
  }

  // Extract topicId from URL parameter
  const { topicId, revisionNumber, all } = req.query;

  // Validate topicId
  if (!topicId || typeof topicId !== "string") {
    return res.status(400).json({ error: "Invalid topic ID" });
  }

  try {
    // Option 1: Return all revisions for this topic
    if (all === "true") {
      const results = await db
        .select()
        .from(screeningResults)
        .where(eq(screeningResults.topicId, topicId))
        .orderBy(desc(screeningResults.revisionNumber));

      if (!results || results.length === 0) {
        return res.status(404).json({
          error: "No screening results found",
          message: `No screenings exist for topic ${topicId}`,
        });
      }

      return res.status(200).json({
        topicId,
        screenings: results.map((screening) => ({
          revisionNumber: screening.revisionNumber,
          evaluation: screening.evaluation,
          qualityScore: screening.qualityScore,
          attentionScore: screening.attentionScore,
          title: screening.title,
          nearAccount: screening.nearAccount,
          model: (screening.evaluation as any)?.model ?? null,
          timestamp: screening.timestamp.toISOString(),
        })),
        total: results.length,
      });
    }

    // Option 2: Get specific revision
    if (revisionNumber !== undefined) {
      const revisionNum = parseInt(revisionNumber as string);

      if (isNaN(revisionNum) || revisionNum < 1) {
        return res.status(400).json({
          error: "Invalid revision number",
          message: "revisionNumber must be a positive integer",
        });
      }

      const result = await db
        .select()
        .from(screeningResults)
        .where(
          and(
            eq(screeningResults.topicId, topicId),
            eq(screeningResults.revisionNumber, revisionNum)
          )
        )
        .limit(1);

      if (!result || result.length === 0) {
        return res.status(404).json({
          error: "No screening results found",
          message: `No screening exists for topic ${topicId} revision ${revisionNum}`,
        });
      }

      const screening = result[0];

      return res.status(200).json({
        revisionNumber: screening.revisionNumber,
        evaluation: screening.evaluation,
        qualityScore: screening.qualityScore,
        attentionScore: screening.attentionScore,
        title: screening.title,
        nearAccount: screening.nearAccount,
        model: (screening.evaluation as any)?.model ?? null,
        timestamp: screening.timestamp.toISOString(),
      });
    }

    // Option 3: Get latest revision (default behavior)
    const result = await db
      .select()
      .from(screeningResults)
      .where(eq(screeningResults.topicId, topicId))
      .orderBy(desc(screeningResults.revisionNumber))
      .limit(1);

    // Handle case where no screening exists
    if (!result || result.length === 0) {
      return res.status(404).json({
        error: "No screening results found",
        message: `No screening exists for topic ${topicId}`,
      });
    }

    const screening = result[0];

    // Return screening data with revision number and computed scores
    return res.status(200).json({
      revisionNumber: screening.revisionNumber,
      evaluation: screening.evaluation,
      qualityScore: screening.qualityScore,
      attentionScore: screening.attentionScore,
      title: screening.title,
      nearAccount: screening.nearAccount,
      model: (screening.evaluation as any)?.model ?? null,
      timestamp: screening.timestamp.toISOString(),
    });
  } catch (error) {
    console.error("[getAnalysis] Database error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch screening results",
      details:
        process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
}
