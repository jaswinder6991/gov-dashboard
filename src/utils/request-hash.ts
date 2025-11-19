import { createHash } from "crypto";

const sha256 = (input: string): string =>
  createHash("sha256").update(Buffer.from(input, "utf8")).digest("hex");

/**
 * Calculates SHA-256 hash of the exact request body.
 * Pass the raw JSON string sent to NEAR AI to avoid ordering differences.
 */
export const calculateRequestHash = (body: string | Record<string, unknown>): string => {
  const payload = typeof body === "string" ? body : JSON.stringify(body ?? {});
  return sha256(payload);
};

export const calculateResponseHash = (responseText: string): string => {
  return sha256(responseText);
};

/**
 * Calculates a hash for SSE streaming responses.
 * The input should be the raw text exactly as received (including blank lines).
 */
export const calculateStreamingHash = (sseText: string): string => {
  // Do NOT trim; trailing newlines are required per NEAR AI docs.
  return calculateResponseHash(sseText);
};

/**
 * Validates that a signature text matches the concatenated request/response hashes.
 */
export const validateHashPair = (
  requestHash: string | null | undefined,
  responseHash: string | null | undefined,
  signatureText: string | null | undefined
): boolean => {
  if (!requestHash || !responseHash || !signatureText) return false;
  return `${requestHash}:${responseHash}`.toLowerCase() === signatureText.toLowerCase();
};
