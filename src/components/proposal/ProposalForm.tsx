import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Shield } from "lucide-react";

interface ProposalFormProps {
  title: string;
  proposal: string;
  onTitleChange: (value: string) => void;
  onProposalChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export const ProposalForm = ({
  title,
  proposal,
  onTitleChange,
  onProposalChange,
  onSubmit,
  loading,
}: ProposalFormProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Proposal Title</Label>
        <Input
          id="title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Enter a clear, descriptive title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal">
          Proposal Content
          <span className="text-xs text-muted-foreground ml-1">
            — Include objectives, budget, timeline, and KPIs
          </span>
        </Label>
        <Textarea
          id="proposal"
          value={proposal}
          onChange={(e) => onProposalChange(e.target.value)}
          placeholder="Paste your full proposal here..."
          rows={14}
          className="font-mono text-sm resize-none"
        />
      </div>

      <Button
        onClick={onSubmit}
        disabled={loading}
        className="w-full gap-2"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Evaluating proposal...
          </>
        ) : (
          <>
            <Shield className="h-4 w-4" />
            Screen Proposal
          </>
        )}
      </Button>
    </div>
  );
};
