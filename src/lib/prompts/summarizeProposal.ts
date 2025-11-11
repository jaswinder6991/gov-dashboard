/**
 * Generates the AI prompt for summarizing NEAR governance proposals
 * @param topicData - Topic information including title and category
 * @param proposalPost - Post data including author username
 * @param truncatedContent - Truncated proposal content
 * @returns Complete prompt string for AI proposal summarization
 */
export function buildProposalSummaryPrompt(
  topicData: { title: string; category_id: number },
  proposalPost: { username: string },
  truncatedContent: string
): string {
  return `You are summarizing a NEAR governance proposal. Provide a comprehensive executive summary.

**Title:** ${topicData.title}
**Author:** @${proposalPost.username}
**Category:** ${topicData.category_id}

**Proposal Content:**
${truncatedContent}

Provide a structured summary covering:

**Overview**
[<200 chars: problem → action → how]

**What**
[<100 chars; core ask]

**Why**
[<200 chars; ecosystem alignment + expected upside]

**How**
[<300 chars; budget, timeline, requirements, dependencies]

**Risks**
[<200 chars; failure modes and tradeoffs]

Be thorough but concise. Focus on information relevant to decision-making.`;
}
