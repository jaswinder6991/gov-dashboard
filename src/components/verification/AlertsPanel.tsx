import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import type { VerificationProofResponse } from "@/types/verification";

export interface AlertsPanelProps {
  missingExpectations: string[];
  remoteProof: VerificationProofResponse | null;
  prefetchedProof: VerificationProofResponse | null;
  verificationId?: string;
  loading: boolean;
  fetchError: string | null;
}

export function AlertsPanel({
  missingExpectations,
  remoteProof,
  prefetchedProof,
  verificationId,
  loading,
  fetchError,
}: AlertsPanelProps) {
  return (
    <>
      {missingExpectations.length > 0 && !remoteProof && !prefetchedProof && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">
            Hardware expectations required
          </AlertTitle>
          <AlertDescription className="text-amber-800">
            Provide a nonce, GPU arch, device cert hash, RIM hash, UEID, and expected measurements
            from the server to fetch or verify this proof. Missing:{" "}
            {missingExpectations.join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      {!verificationId && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">No Verification ID</AlertTitle>
          <AlertDescription className="text-amber-800">
            Proofs are only accessible for 5 minutes after completion, or indefinitely once queried
            within that window.
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Fetching cryptographic proof from TEE...</span>
        </div>
      )}

      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to Fetch Proof</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {fetchError}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
