import { buildScreeningPrompt } from "./screenProposal";
import { buildProposalSummaryPrompt } from "./summarizeProposal";
import { buildRevisionAnalysisPrompt } from "./summarizeRevisions";
import { buildDiscussionSummaryPrompt } from "./summarizeDiscussion";
import { buildReplySummaryPrompt } from "./summarizeReply";

type PromptField = {
  name: string;
  label: string;
  placeholder?: string;
  rows?: number;
};

type PromptBuilderConfig = {
  fields: PromptField[];
  buildPrompt: (values: Record<string, string>) => string;
};

const prompts: Record<string, PromptBuilderConfig> = {
  screenProposal: {
    fields: [
      { name: "title", label: "Proposal Title", placeholder: "Enter proposal title" },
      {
        name: "content",
        label: "Proposal Content",
        placeholder: "Paste full proposal content",
        rows: 12,
      },
    ],
    buildPrompt: ({ title = "", content = "" }) =>
      buildScreeningPrompt(title, content),
  },
  summarizeProposal: {
    fields: [
      { name: "title", label: "Proposal Title" },
      { name: "categoryId", label: "Category ID", placeholder: "e.g. 1" },
      { name: "author", label: "Author Username" },
      {
        name: "content",
        label: "Proposal Content",
        rows: 12,
      },
    ],
    buildPrompt: ({ title = "", categoryId = "0", author = "", content = "" }) =>
      buildProposalSummaryPrompt(
        { title, category_id: Number(categoryId) || 0 },
        { username: author || "author" },
        content
      ),
  },
  summarizeRevisions: {
    fields: [
      { name: "author", label: "Author Username" },
      { name: "currentVersion", label: "Current Version", placeholder: "e.g. 3" },
      {
        name: "timeline",
        label: "Revision Timeline",
        placeholder: "Provide formatted revision timeline",
        rows: 10,
      },
    ],
    buildPrompt: ({
      postId = "1",
      author = "author",
      currentVersion = "1",
      timeline = "",
    }) =>
      buildRevisionAnalysisPrompt(
        postId,
        { username: author },
        [],
        Number(currentVersion) || 1,
        timeline
      ),
  },
  summarizeDiscussion: {
    fields: [
      { name: "title", label: "Topic Title" },
      { name: "totalLikes", label: "Total Likes", placeholder: "e.g. 42" },
      { name: "avgLikes", label: "Average Likes", placeholder: "e.g. 3.2" },
      { name: "maxLikes", label: "Max Likes", placeholder: "e.g. 12" },
      {
        name: "highlyEngaged",
        label: "Highly Engaged Replies",
        placeholder: "e.g. 5",
      },
      {
        name: "discussion",
        label: "Discussion Transcript",
        placeholder: "Paste discussion content",
        rows: 12,
      },
    ],
    buildPrompt: ({
      title = "Untitled Topic",
      totalLikes = "0",
      avgLikes = "0",
      maxLikes = "0",
      highlyEngaged = "0",
      discussion = "",
    }) =>
      buildDiscussionSummaryPrompt(
        { title },
        [],
        Number(totalLikes) || 0,
        Number(avgLikes) || 0,
        Number(maxLikes) || 0,
        Number(highlyEngaged) || 0,
        discussion
      ),
  },
  summarizeReply: {
    fields: [
      { name: "author", label: "Reply Author" },
      { name: "postNumber", label: "Post Number", placeholder: "e.g. 12" },
      {
        name: "replyTo",
        label: "Replying To Post # (optional)",
        placeholder: "e.g. 5",
      },
      {
        name: "replyToUser",
        label: "Replying To User (optional)",
        placeholder: "e.g. alice.near",
      },
      { name: "likes", label: "Like Count", placeholder: "e.g. 4" },
      {
        name: "content",
        label: "Reply Content",
        rows: 8,
      },
    ],
    buildPrompt: ({
      author = "author",
      postNumber = "1",
      replyTo = "",
      replyToUser = "",
      likes = "0",
      content = "",
    }) =>
      buildReplySummaryPrompt(
        {
          username: author,
          post_number: Number(postNumber) || 1,
          reply_to_post_number: replyTo ? Number(replyTo) : undefined,
          reply_to_user: replyToUser ? { username: replyToUser } : undefined,
        },
        Number(likes) || 0,
        content
      ),
  },
};

export default prompts;
