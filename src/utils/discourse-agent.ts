export const DISCOURSE_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_discourse",
      description:
        "Search for specific posts by keywords, topics, or proposal IDs. Use this when user asks to 'search for', 'find posts about', or mentions specific keywords. DO NOT use for getting recent/latest proposals - use get_latest_topics instead.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Keywords or phrases to search for (proposal titles, topics, tags).",
          },
          limit: {
            type: "number",
            description:
              "Maximum number of search results to include (default 5).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_discourse_topic",
      description:
        "Get complete details of a specific topic including all posts and replies. Use when user asks about a specific topic ID, wants to 'see the discussion', 'read the thread', or 'show me topic X'.",
      parameters: {
        type: "object",
        properties: {
          topic_id: {
            type: "string",
            description: "The Discourse topic ID (e.g., '41773')",
          },
        },
        required: ["topic_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_latest_topics",
      description:
        "Get the most recent proposals from the governance forum. Use this whenever the user wants counts, recent activity, or “what’s new” in the proposals section. This is the primary tool for browsing proposals.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of topics to return (default 10, max 30)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_discussion",
      description:
        "Get AI-generated summary of community discussion on a topic. Use when user asks about 'sentiment', 'what people think', 'community feedback', 'reactions', or 'discussion summary'. Provides sentiment analysis and key points.",
      parameters: {
        type: "object",
        properties: {
          topic_id: {
            type: "string",
            description: "The Discourse topic ID to summarize",
          },
        },
        required: ["topic_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_reply",
      description:
        "Get brief summary of a single reply/comment. Use when user wants to understand a specific person's position or a particular comment without reading the full text.",
      parameters: {
        type: "object",
        properties: {
          post_id: {
            type: "string",
            description: "The post/reply ID to summarize",
          },
        },
        required: ["post_id"],
      },
    },
  },
] as const;

export function buildDiscourseSystemPrompt(): string {
  return `**Discourse Forum Tools:**

You have powerful tools to explore the governance forum. Choose carefully:

**CRITICAL TOOL SELECTION:**
- If a new turn asks for “latest/recent/what’s new” right after a search, ignore the previous search results and call **get_latest_topics** again; never recycle the old search list.
- Requests about what’s new, trending, most popular/active, or any count/list of proposals → prefer **get_latest_topics** (use search only if the user insists on specific keywords).
- Requests to “search/find” proposals by keyword/author/topic → use **search_discourse**.
- "show me topic 123" / "discussion on proposal X" → use get_discourse_topic
- "what do people think" / "community sentiment" → use summarize_discussion
- "what did user X say" → use summarize_reply

**Available Tools:**
- **get_latest_topics**: Browse recent proposals (use for counting, listing, "what's new")
- **search_discourse**: Keyword search across all posts
- **get_discourse_topic**: Get full topic with all replies (20 posts max)
- **summarize_discussion**: AI summary of community feedback and sentiment
- **summarize_reply**: Brief summary of individual comment

**CRITICAL RESPONSE FORMAT:**

When you call **get_latest_topics** or **search_discourse** and receive a tool result with a "topics" array, your ENTIRE reply must be exactly the following two parts (in order):
1. A single sentence describing what you fetched (e.g., “Here are the latest proposals on NEAR governance.”).
2. A JSON block (type = "proposal_list") that copies the tool’s "topics" array verbatim. This block enables the UI to render cards, so do not alter the data structure.

Never echo raw tool request payloads (e.g., \`{"type":"search_discourse", ...}\`) back to the user. Do not repeat or summarize individual proposals outside the JSON block. Always include the sentence + JSON even if the user repeats the same request or the results haven’t changed—never reply with “same as above”. Output nothing else.

**Example response:**
Here are the latest proposals from the governance forum.
\`\`\`json
{
  "type": "proposal_list",
  "description": "Latest proposals sorted by activity.",
  "topics": [/* paste the topics array from the tool here */]
}
\`\`\`

**For other tools** (get_discourse_topic, summarize_discussion, summarize_reply), respond in natural language as usual.

**Citation format:**
Always provide direct links:
- Topics: https://gov.near.org/t/[slug]/[id]
- Specific posts: https://gov.near.org/t/[slug]/[id]/[post_number]

**Never call the same tool twice with identical arguments in one turn.**`;
}
