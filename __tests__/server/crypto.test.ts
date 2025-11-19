import { describe, it, expect } from "vitest";
import { createPublicKey, verify } from "@/server/crypto";
import { createSign } from "crypto";

// JWK for P-256
const jwkES256 = {
  kty: "EC",
  crv: "P-256",
  x: "f83OJ3D2xF4vAln_-rhIRbkIuWGHWxirMRHkRkNvztY",
  y: "x_FEzRu9cNIbp1oWXc2M27XGr0CcsMEY_Y-g8r3OJek",
  kid: "es256-key",
};

describe("server/crypto", () => {
  it("creates a public key from JWK and verifies ES256 signature", () => {
    const publicKey = createPublicKey(jwkES256 as any);

    const signer = createSign("SHA256");
    signer.update("hello");
    const pem = publicKey.export({ format: "pem", type: "spki" }).toString();
    const sigBase64 = signer.sign(pem, "base64");
    const signature = Buffer.from(sigBase64, "base64");

    const ok = verify("ES256", Buffer.from("hello"), publicKey, signature);
    expect(ok).toBe(true);
  });

  it("throws for invalid JWK", () => {
    expect(() => createPublicKey({ kty: "EC", crv: "P-256" } as any)).toThrow();
  });

  it("fails verification with wrong data", () => {
    const publicKey = createPublicKey(jwkES256 as any);
    const signer = createSign("SHA256");
    signer.update("hello");
    const pem = publicKey.export({ format: "pem", type: "spki" }).toString();
    const sig = signer.sign(pem, "base64");
    const signature = Buffer.from(sig, "base64");

    const ok = verify("ES256", Buffer.from("bye"), publicKey, signature);
    expect(ok).toBe(false);
  });
});
