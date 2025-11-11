/**
 * Generates the AI prompt for summarizing a single reply in NEAR governance discussions
 * @param replyPost - Reply post data including author, post number, and reply references
 * @param likeCount - Number of likes on the reply
 * @param truncatedContent - Truncated reply content
 * @returns Complete prompt string for AI reply summarization
 */
export function buildReplySummaryPrompt(
  replyPost: {
    username: string;
    post_number: number;
    reply_to_post_number?: number;
    reply_to_user?: { username: string };
  },
  likeCount: number,
  truncatedContent: string
): string {
  return `You are summarizing a single reply in a NEAR governance discussion. Be very concise and focus on the core message.

**Author:** @${replyPost.username}
**Post Number:** #${replyPost.post_number}
${likeCount > 0 ? `**Engagement:** ${likeCount} likes` : ""}
${
  replyPost.reply_to_post_number && replyPost.reply_to_user
    ? `**Replying to:** @${replyPost.reply_to_user.username} (Post #${replyPost.reply_to_post_number})`
    : replyPost.reply_to_post_number
    ? `**Replying to:** Post #${replyPost.reply_to_post_number}`
    : ""
}

**Reply Content:**
${truncatedContent}

Provide a brief summary (50-100 words maximum) covering:

**Position:** [Supporting/Opposing/Suggesting modifications/Asking questions/Providing information${
    replyPost.reply_to_post_number ? "/Responding to specific concern" : ""
  }]

**Main Point:** [1-2 sentences summarizing the core message${
    replyPost.reply_to_post_number
      ? " and how it relates to the post being replied to"
      : ""
  }]

**Key Details:** [Any specific concerns, suggestions, questions, or data mentioned - keep brief]

Be extremely concise. If the reply is very short or simple (like "I agree" or "+1"), just say so directly without elaboration.`;
}
