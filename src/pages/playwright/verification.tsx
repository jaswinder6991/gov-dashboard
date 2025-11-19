import Head from "next/head";
import { VerificationProof } from "@/components/verification/VerificationProof";

export default function PlaywrightVerificationPage() {
  return (
    <>
      <Head>
        <title>Playwright Verification Fixture</title>
      </Head>
      <main className="min-h-screen flex items-center justify-center bg-muted/30 p-8">
        <div className="w-full max-w-3xl space-y-6">
          <h1 className="text-2xl font-semibold">Playwright Verification Fixture</h1>
          <p className="text-sm text-muted-foreground">
            This page renders a VerificationProof component with mock inputs for E2E tests.
          </p>
          <VerificationProof
            verificationId="mock-verification-id"
            nonce="mock-nonce"
            model="playwright/mock-model"
            expectedArch="HOPPER"
            expectedDeviceCertHash="device-hash"
            expectedRimHash="rim-hash"
            expectedUeid="ueid-123"
            expectedMeasurements={["measure-1", "measure-2"]}
          />
        </div>
      </main>
    </>
  );
}
