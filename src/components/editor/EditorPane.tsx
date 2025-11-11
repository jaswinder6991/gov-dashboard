import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Check, X } from "lucide-react";

export function EditorPane({
  title,
  content,
  setTitle,
  setContent,
  disabled,
  renderedPreview,
  viewMode,
  onToggleView,
  showDiffHighlights,
  diffHtml,
  hasPendingChanges,
  onAcceptChanges,
  onRejectChanges,
}: {
  title: string;
  content: string;
  setTitle: (s: string) => void;
  setContent: (s: string) => void;
  disabled: boolean;
  renderedPreview: string;
  viewMode: "editor" | "preview";
  onToggleView: (mode: "editor" | "preview") => void;
  showDiffHighlights: boolean;
  diffHtml?: string;
  hasPendingChanges?: boolean;
  onAcceptChanges?: () => void;
  onRejectChanges?: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Title Input */}
      <div className="space-y-2">
        <Label htmlFor="title">Proposal Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          placeholder="Enter your proposal title…"
          className="text-base font-semibold"
        />
      </div>

      {/* Diff Controls Banner */}
      {hasPendingChanges && showDiffHighlights && (
        <Alert className="bg-orange-50 border-orange-300">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-orange-900 mb-1">
                  AI Suggested Changes
                </div>
                <div className="text-xs text-orange-800">
                  <span className="text-green-700">Green</span> = additions •{" "}
                  <span className="text-red-700">Red</span> = removals
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={onRejectChanges}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  <X className="h-3 w-3" />
                  Reject
                </Button>
                <Button onClick={onAcceptChanges} size="sm" className="gap-1">
                  <Check className="h-3 w-3" />
                  Accept
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => onToggleView(v as any)}>
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
        </Tabs>

        <kbd className="px-2 py-1 text-xs bg-muted border rounded">
          ⌘/Ctrl + E to toggle
        </kbd>
      </div>

      {/* Editor View */}
      {viewMode === "editor" && (
        <div>
          {showDiffHighlights && diffHtml ? (
            <div
              className="min-h-[400px] max-h-[640px] overflow-y-auto p-4 border-2 rounded-lg bg-muted font-mono text-sm leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: diffHtml }}
            />
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={disabled}
              placeholder="Write your proposal in Markdown…

Include:
- Objectives and goals
- Detailed budget breakdown
- Timeline with milestones
- Measurable KPIs"
              rows={24}
              className="font-mono text-sm resize-none"
            />
          )}
        </div>
      )}

      {/* Preview View */}
      {viewMode === "preview" && (
        <div className="min-h-[400px] max-h-[640px] overflow-y-auto p-5 border-2 rounded-lg bg-muted">
          {title && (
            <h1 className="text-2xl font-bold mb-4 text-foreground">{title}</h1>
          )}
          {showDiffHighlights && diffHtml ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: diffHtml }}
            />
          ) : content ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Your markdown preview will appear here…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
