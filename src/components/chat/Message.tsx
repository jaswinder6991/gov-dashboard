// components/chat/Message.tsx
import {
  VerificationProof,
  type RemoteProof,
} from "@/components/verification/VerificationProof";
import ProposalCard from "@/components/proposal/ProposalCard";
import type { VerificationMetadata } from "@/types/agui-events";
import type { ProposalDisplayData } from "@/types/proposals";
import type { PartialExpectations } from "@/utils/attestation-expectations";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

interface MessageProof extends PartialExpectations {
  requestHash?: string;
  responseHash?: string;
}

interface MessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  messageId?: string;
  verification?: VerificationMetadata;
  proof?: MessageProof;
  remoteProof?: RemoteProof | null;
  model?: string;
  markdown: MarkdownIt;
}

const renderMarkdownContent = (
  markdown: MarkdownIt,
  content: string
): { __html: string } => ({
  __html: DOMPurify.sanitize(markdown.render(content || "")),
});

const extractJsonFromMarkdown = (
  content: string
): ProposalDisplayData | null => {
  const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.type === "proposal_list" && Array.isArray(parsed.topics)) {
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse proposal JSON:", e);
    }
  }
  return null;
};

export const Message = ({
  role,
  content,
  timestamp,
  messageId,
  verification,
  proof,
  remoteProof,
  model,
  markdown,
}: MessageProps) => {
  const alignment = role === "user" ? "justify-end" : "justify-start";
  const bubbleClasses =
    role === "user"
      ? "bg-primary text-white rounded-2xl rounded-br-sm shadow-lg"
      : role === "system"
      ? "bg-muted text-foreground/80 border border-dashed rounded-2xl rounded-bl-sm shadow-sm"
      : "bg-card text-card-foreground rounded-2xl rounded-bl-sm border border-border shadow-md";

  const baseProse =
    "prose prose-sm max-w-none text-sm leading-relaxed prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-headings:mt-4 prose-headings:mb-2";
  const proseClass =
    role === "user"
      ? `${baseProse} prose-invert text-white [&_*]:text-white`
      : `${baseProse} text-foreground dark:prose-invert`;

  const senderLabel =
    role === "user" ? "You" : role === "assistant" ? "Agent" : "System";

  const labelClass =
    role === "user" ? "text-white/80" : "text-muted-foreground text-xs";

  const showProof =
    role === "assistant" && Boolean(verification || proof || remoteProof);

  const proposalData =
    role === "assistant" ? extractJsonFromMarkdown(content) : null;

  return (
    <div className={`flex ${alignment}`}>
      <div
        className={`max-w-[80%] min-w-[140px] sm:min-w-[200px] rounded-2xl px-4 py-2 ${
          showProof ? "pb-4" : ""
        } ${bubbleClasses}`}
      >
        <div className="flex items-center justify-between mb-2">
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${labelClass}`}
          >
            {senderLabel}
          </p>
          <span className="text-[10px] text-white/60">
            {timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {proposalData ? (
          <div className="space-y-4">
            {proposalData.description && (
              <p className="text-sm mb-3">{proposalData.description}</p>
            )}
            <div className="space-y-3">
              {proposalData.topics.map((topic) => (
                <ProposalCard
                  key={topic.id}
                  id={topic.id}
                  title={topic.title}
                  excerpt={topic.excerpt}
                  created_at={topic.created_at}
                  username={topic.author}
                  topic_id={topic.id}
                  topic_slug={topic.slug}
                  reply_count={topic.reply_count}
                  views={topic.views}
                  last_posted_at={topic.last_posted_at}
                />
              ))}
            </div>
          </div>
        ) : (
          <div
            className={proseClass}
            dangerouslySetInnerHTML={renderMarkdownContent(markdown, content)}
          />
        )}
        {showProof && (
          <VerificationProof
            verification={verification}
            verificationId={messageId}
            model={model}
            requestHash={proof?.requestHash}
            responseHash={proof?.responseHash}
            nonce={proof?.nonce ?? undefined}
            expectedArch={proof?.arch ?? undefined}
            expectedDeviceCertHash={proof?.deviceCertHash ?? undefined}
            expectedRimHash={proof?.rimHash ?? undefined}
            expectedUeid={proof?.ueid ?? undefined}
            expectedMeasurements={proof?.measurements ?? undefined}
            prefetchedProof={remoteProof}
            className="mt-3"
          />
        )}
      </div>
    </div>
  );
};
