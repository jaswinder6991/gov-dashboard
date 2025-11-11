import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface WalletStatusProps {
  signedAccountId: string | undefined;
  loading?: boolean;
  showWarningIfNotConnected?: boolean;
}

export const WalletStatus = ({
  signedAccountId,
  loading,
  showWarningIfNotConnected = true,
}: WalletStatusProps) => {
  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-3 w-[150px]" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!signedAccountId && showWarningIfNotConnected) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Please connect your NEAR wallet to continue.
        </AlertDescription>
      </Alert>
    );
  }

  if (signedAccountId) {
    return (
      <Card className="mb-6 border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-900">
                NEAR Wallet Connected
              </h3>
              <p className="text-sm text-green-700">{signedAccountId}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
