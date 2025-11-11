import { NextApiRequest, NextApiResponse } from "next";
import type { Evaluation } from "@/types/evaluation";
import {
  sanitizeProposalInput,
  verifyNearAuth,
  requestEvaluation,
  respondWithScreeningError,
} from "@/lib/server/screening";

/**
 * POST /api/screen
 *
 * Authenticated screening endpoint - evaluates proposals WITHOUT saving.
 * Requires NEAR wallet signature for authentication (NEP-413).
 */

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 5;

function checkRateLimit(key: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  let verificationResult;
  try {
    ({ result: verificationResult } = await verifyNearAuth(authHeader));
  } catch (error) {
    return respondWithScreeningError(
      res,
      error,
      "Please connect your NEAR wallet to use this feature"
    );
  }

  const nearAddress = verificationResult.accountId;

  // Check rate limit (by NEAR address)
  const { allowed, resetTime } = checkRateLimit(nearAddress);

  if (!allowed) {
    const retryAfter = resetTime
      ? Math.ceil((resetTime - Date.now()) / 1000)
      : 60;
    res.setHeader("Retry-After", retryAfter.toString());
    return res.status(429).json({
      error: "Too many requests",
      message: `Rate limit exceeded. Please try again in ${Math.ceil(
        retryAfter / 60
      )} minutes.`,
      retryAfter,
    });
  }

  const { title, proposal } = req.body;
  let sanitizedTitle: string;
  let sanitizedProposal: string;
  try {
    const sanitized = sanitizeProposalInput(title, proposal);
    sanitizedTitle = sanitized.title;
    sanitizedProposal = sanitized.content;
  } catch (error) {
    return respondWithScreeningError(res, error);
  }

  try {
    const evaluation: Evaluation = await requestEvaluation(
      sanitizedTitle,
      sanitizedProposal
    );

    console.log(
      `[Screen] Evaluation complete for ${nearAddress} - Pass: ${
        evaluation.overallPass
      }, Quality: ${(evaluation.qualityScore * 100).toFixed(0)}%, Attention: ${(
        evaluation.attentionScore * 100
      ).toFixed(0)}%`
    );

    return res.status(200).json({
      evaluation,
      authenticatedAs: nearAddress,
    });
  } catch (error) {
    return respondWithScreeningError(res, error, "Failed to evaluate proposal");
  }
}
