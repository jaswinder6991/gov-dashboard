import { useState } from "react";
import type { Evaluation } from "@/types/evaluation";
import { sign } from "near-sign-verify";
import { Button } from "@/components/ui/button";

interface ScreeningButtonProps {
  topicId: string;
  title: string;
  content: string;
  nearAccount: string;
  wallet: any;
  revisionNumber: number;
  onScreeningComplete?: () => void;
}

export function ScreeningButton({
  topicId,
  title,
  content,
  nearAccount,
  wallet,
  revisionNumber,
  onScreeningComplete,
}: ScreeningButtonProps) {
  const [screening, setScreening] = useState(false);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");

  const prepareContent = (html: string): string => {
    const normalized = html;
    if (typeof document !== "undefined") {
      const div = document.createElement("div");
      div.innerHTML = normalized;
      return (div.textContent || div.innerText || "")
        .replace(/\r?\n{3,}/g, "\n\n")
        .trim();
    }
    return normalized
      .replace(/<[^>]*>/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  };

  const handleScreen = async () => {
    setScreening(true);
    setError("");
    setResult(null);

    try {
      if (!wallet)
        throw new Error(
          "Wallet not connected. Please connect your NEAR wallet."
        );
      if (!nearAccount)
        throw new Error("NEAR account not found. Please connect your wallet.");

      const authToken = await sign(`Screen proposal ${topicId}`, {
        signer: wallet,
        recipient: "social.near",
      });

      const saveResponse = await fetch(`/api/saveAnalysis/${topicId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title,
          content: prepareContent(content),
          revisionNumber,
        }),
      });

      const saveData = await saveResponse.json();
      if (!saveResponse.ok) {
        if (saveResponse.status === 401)
          setError("Authentication failed. Please try signing again.");
        else if (saveResponse.status === 409)
          setError(
            saveData.message ||
              "This proposal revision has already been evaluated."
          );
        else if (saveResponse.status === 429)
          setError(
            saveData.message || "Rate limit exceeded. Please try again later."
          );
        else
          throw new Error(
            saveData.error || `Failed to save screening: ${saveResponse.status}`
          );
        return;
      }

      setResult(saveData.evaluation);
      if (onScreeningComplete) onScreeningComplete();
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to screen proposal");
    } finally {
      setScreening(false);
    }
  };

  const formatScore = (score: number) => `${(score * 100).toFixed(0)}%`;

  if (result) {
    return (
      <div
        className="card mb-8"
        style={{
          backgroundColor: result.overallPass ? "#f0fdf4" : "#fef2f2",
          borderLeft: `4px solid ${result.overallPass ? "#10b981" : "#ef4444"}`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{result.overallPass ? "✓" : "✗"}</span>
          <h3 className="text-lg font-semibold">
            {result.overallPass ? "Screening Passed" : "Screening Failed"}
          </h3>
        </div>

        <div className="mb-3 text-sm">
          <div className="flex gap-4 mb-1">
            <div>
              <strong>Quality:</strong> {formatScore(result.qualityScore)}
            </div>
            <div>
              <strong>Attention:</strong> {formatScore(result.attentionScore)}
            </div>
          </div>
          <p className="text-muted-foreground">
            Relevant: {result.relevant?.score || "unknown"} • Material:{" "}
            {result.material?.score || "unknown"}
          </p>
        </div>

        <p className="mb-3">
          <strong>Summary:</strong> {result.summary}
        </p>
        <p className="text-sm text-muted-foreground">
          ✓ Results saved! Page will refresh shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="card mb-8 p-4">
      <h3 className="text-lg font-semibold mb-2">AI Screening</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Screen this proposal (version {revisionNumber}) against NEAR governance
        criteria using AI.
        {!wallet && (
          <span className="block mt-1 text-red-500">
            ⚠ Please connect your NEAR wallet to screen proposals.
          </span>
        )}
      </p>
      {error && (
        <div className="text-red-600 text-sm border border-red-300 bg-red-50 p-2 rounded mb-3">
          ⚠ {error}
        </div>
      )}
      <Button
        onClick={handleScreen}
        disabled={screening || !wallet || !nearAccount}
        className="w-full"
      >
        {screening
          ? "Screening..."
          : wallet && nearAccount
          ? "Screen This Proposal"
          : "Connect Wallet to Screen"}
      </Button>
    </div>
  );
}
