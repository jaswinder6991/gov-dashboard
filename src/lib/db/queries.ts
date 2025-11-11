import { db } from "./index";
import {
  screeningResults,
  type NewScreeningResult,
  type ScreeningResult,
} from "./schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

/**
 * Get screening result by topic ID and revision number
 */
export async function getScreeningResult(
  topicId: string,
  revisionNumber: number
): Promise<ScreeningResult | null> {
  const result = await db
    .select()
    .from(screeningResults)
    .where(
      and(
        eq(screeningResults.topicId, topicId),
        eq(screeningResults.revisionNumber, revisionNumber)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Get the latest screening result for a topic
 */
export async function getLatestScreeningResult(
  topicId: string
): Promise<ScreeningResult | null> {
  const result = await db
    .select()
    .from(screeningResults)
    .where(eq(screeningResults.topicId, topicId))
    .orderBy(desc(screeningResults.revisionNumber))
    .limit(1);

  return result[0] || null;
}

/**
 * Get all screening results for a specific topic (all revisions)
 */
export async function getScreeningsByTopic(
  topicId: string
): Promise<ScreeningResult[]> {
  return db
    .select()
    .from(screeningResults)
    .where(eq(screeningResults.topicId, topicId))
    .orderBy(desc(screeningResults.revisionNumber));
}

/**
 * Save screening result with computed scores
 */
export async function saveScreeningResult(
  data: NewScreeningResult
): Promise<void> {
  // Extract quality and attention scores from evaluation
  const evaluation = data.evaluation as any;
  const qualityScore = evaluation.qualityScore ?? null;
  const attentionScore = evaluation.attentionScore ?? null;

  await db.insert(screeningResults).values({
    ...data,
    qualityScore,
    attentionScore,
  });
}

/**
 * Get all screening results for a NEAR account
 * Returns latest revision of each topic by default
 */
export async function getScreeningsByAccount(
  nearAccount: string,
  latestOnly = true
): Promise<ScreeningResult[]> {
  if (!latestOnly) {
    // Return all revisions for all topics
    return db
      .select()
      .from(screeningResults)
      .where(eq(screeningResults.nearAccount, nearAccount))
      .orderBy(desc(screeningResults.timestamp));
  }

  // Get latest revision for each topic
  const allResults = await db
    .select()
    .from(screeningResults)
    .where(eq(screeningResults.nearAccount, nearAccount))
    .orderBy(desc(screeningResults.timestamp));

  const ranked = db
    .select({
      topicId: screeningResults.topicId,
      revisionNumber: screeningResults.revisionNumber,
      evaluation: screeningResults.evaluation,
      title: screeningResults.title,
      nearAccount: screeningResults.nearAccount,
      timestamp: screeningResults.timestamp,
      revisionTimestamp: screeningResults.revisionTimestamp,
      qualityScore: screeningResults.qualityScore,
      attentionScore: screeningResults.attentionScore,
      rowNumber: sql<number>`
        row_number() over (
          partition by ${screeningResults.topicId}
          order by ${screeningResults.revisionNumber} desc
        )
      `.as("rowNumber"),
    })
    .from(screeningResults)
    .where(eq(screeningResults.nearAccount, nearAccount))
    .as("ranked");

  return db
    .select({
      topicId: ranked.topicId,
      revisionNumber: ranked.revisionNumber,
      evaluation: ranked.evaluation,
      title: ranked.title,
      nearAccount: ranked.nearAccount,
      timestamp: ranked.timestamp,
      revisionTimestamp: ranked.revisionTimestamp,
      qualityScore: ranked.qualityScore,
      attentionScore: ranked.attentionScore,
    })
    .from(ranked)
    .where(eq(ranked.rowNumber, 1))
    .orderBy(desc(ranked.timestamp));
}

/**
 * Get recent screening results (latest revision of each topic)
 */
export async function getRecentScreenings(
  limit = 10
): Promise<ScreeningResult[]> {
  const ranked = db
    .select({
      topicId: screeningResults.topicId,
      revisionNumber: screeningResults.revisionNumber,
      evaluation: screeningResults.evaluation,
      title: screeningResults.title,
      nearAccount: screeningResults.nearAccount,
      timestamp: screeningResults.timestamp,
      revisionTimestamp: screeningResults.revisionTimestamp,
      qualityScore: screeningResults.qualityScore,
      attentionScore: screeningResults.attentionScore,
      rowNumber: sql<number>`
        row_number() over (
          partition by ${screeningResults.topicId}
          order by ${screeningResults.revisionNumber} desc
        )
      `.as("rowNumber"),
    })
    .from(screeningResults)
    .as("ranked");

  return db
    .select({
      topicId: ranked.topicId,
      revisionNumber: ranked.revisionNumber,
      evaluation: ranked.evaluation,
      title: ranked.title,
      nearAccount: ranked.nearAccount,
      timestamp: ranked.timestamp,
      revisionTimestamp: ranked.revisionTimestamp,
      qualityScore: ranked.qualityScore,
      attentionScore: ranked.attentionScore,
    })
    .from(ranked)
    .where(eq(ranked.rowNumber, 1))
    .orderBy(desc(ranked.timestamp))
    .limit(limit);
}

/**
 * NEW: Get screenings filtered by quality score
 */
export async function getScreeningsByQuality(
  minScore: number,
  maxScore: number = 1.0,
  limit = 20
): Promise<ScreeningResult[]> {
  return db
    .select()
    .from(screeningResults)
    .where(
      and(
        gte(screeningResults.qualityScore, minScore),
        lte(screeningResults.qualityScore, maxScore)
      )
    )
    .orderBy(desc(screeningResults.timestamp))
    .limit(limit);
}

/**
 * NEW: Get screenings filtered by attention score
 */
export async function getScreeningsByAttention(
  minScore: number,
  maxScore: number = 1.0,
  limit = 20
): Promise<ScreeningResult[]> {
  return db
    .select()
    .from(screeningResults)
    .where(
      and(
        gte(screeningResults.attentionScore, minScore),
        lte(screeningResults.attentionScore, maxScore)
      )
    )
    .orderBy(desc(screeningResults.timestamp))
    .limit(limit);
}

/**
 * NEW: Get high-quality, high-attention proposals
 */
export async function getTopProposals(limit = 10): Promise<ScreeningResult[]> {
  return db
    .select()
    .from(screeningResults)
    .where(
      and(
        gte(screeningResults.qualityScore, 0.8),
        gte(screeningResults.attentionScore, 0.75)
      )
    )
    .orderBy(
      desc(screeningResults.qualityScore),
      desc(screeningResults.attentionScore),
      desc(screeningResults.timestamp)
    )
    .limit(limit);
}

/**
 * NEW: Get screenings by relevance score
 */
export async function getScreeningsByRelevance(
  relevance: "high" | "medium" | "low",
  limit = 20
): Promise<ScreeningResult[]> {
  return db
    .select()
    .from(screeningResults)
    .where(
      sql`(${screeningResults.evaluation}->'relevant'->>'score') = ${relevance}`
    )
    .orderBy(desc(screeningResults.timestamp))
    .limit(limit);
}

/**
 * NEW: Get screenings by materiality score
 */
export async function getScreeningsByMateriality(
  material: "high" | "medium" | "low",
  limit = 20
): Promise<ScreeningResult[]> {
  return db
    .select()
    .from(screeningResults)
    .where(
      sql`(${screeningResults.evaluation}->'material'->>'score') = ${material}`
    )
    .orderBy(desc(screeningResults.timestamp))
    .limit(limit);
}

/**
 * NEW: Get statistics for screenings
 */
export async function getScreeningStats(): Promise<{
  total: number;
  passed: number;
  failed: number;
  avgQualityScore: number;
  avgAttentionScore: number;
}> {
  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      passed: sql<number>`
        COUNT(*) FILTER (
          WHERE (evaluation->>'overallPass')::boolean = true
        )
      `,
      avgQualityScore: sql<number>`AVG(${screeningResults.qualityScore})`,
      avgAttentionScore: sql<number>`AVG(${screeningResults.attentionScore})`,
    })
    .from(screeningResults);

  const total = Number(row?.total ?? 0);
  const passed = Number(row?.passed ?? 0);

  return {
    total,
    passed,
    failed: Math.max(total - passed, 0),
    avgQualityScore: Number(row?.avgQualityScore ?? 0),
    avgAttentionScore: Number(row?.avgAttentionScore ?? 0),
  };
}

/**
 * Delete screening result by topic ID and revision number
 * Should only be used by admins/moderators
 */
export async function deleteScreeningResult(
  topicId: string,
  revisionNumber: number
): Promise<void> {
  await db
    .delete(screeningResults)
    .where(
      and(
        eq(screeningResults.topicId, topicId),
        eq(screeningResults.revisionNumber, revisionNumber)
      )
    );
}

/**
 * Delete all screening results for a topic (all revisions)
 * Should only be used by admins/moderators
 */
export async function deleteAllScreeningsForTopic(
  topicId: string
): Promise<void> {
  await db
    .delete(screeningResults)
    .where(eq(screeningResults.topicId, topicId));
}

/**
 * Count total screening results
 */
export async function countScreenings(): Promise<number> {
  const result = await db
    .select({ count: screeningResults.topicId })
    .from(screeningResults);

  return result.length;
}

/**
 * Count unique topics (not revisions)
 */
export async function countUniqueTopics(): Promise<number> {
  const result = await db
    .selectDistinct({ topicId: screeningResults.topicId })
    .from(screeningResults);

  return result.length;
}
