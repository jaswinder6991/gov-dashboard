"use client";

import { useEffect, useState } from "react";

// Type placeholders
type NearWallet = any;
type NearConnector = any;
type JsonRpcProvider = any;

interface ViewFunctionParams {
  contractId: string;
  method: string;
  args?: Record<string, any>;
}

interface CallFunctionParams {
  contractId: string;
  method: string;
  args?: Record<string, any>;
  gas?: string;
  deposit?: string;
}

export function useNear() {
  const [wallet, setWallet] = useState<NearWallet | undefined>(undefined);
  const [signedAccountId, setSignedAccountId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [connector, setConnector] = useState<NearConnector | null>(null);
  const [provider, setProvider] = useState<JsonRpcProvider | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") {
      setLoading(false);
      return;
    }

    let nearConnector: any;
    let isSubscribed = true;

    async function initNear() {
      try {
        const [{ NearConnector }, { JsonRpcProvider }] = await Promise.all([
          import("@hot-labs/near-connect"),
          import("@near-js/providers"),
        ]);

        if (!isSubscribed) return;

        nearConnector = new NearConnector({ network: "mainnet" });
        const rpcProvider = new JsonRpcProvider({
          url: "https://rpc.fastnear.com",
        });

        setConnector(nearConnector);
        setProvider(rpcProvider);

        try {
          const { wallet, accounts } = await nearConnector.getConnectedWallet();
          if (isSubscribed && wallet && accounts?.length > 0) {
            setWallet(wallet);
            setSignedAccountId(accounts[0].accountId);
          }
        } catch (error) {
          console.log("No wallet connected yet:", error);
        }

        nearConnector.on("wallet:signOut", () => {
          if (isSubscribed) {
            setWallet(undefined);
            setSignedAccountId("");
          }
        });

        nearConnector.on("wallet:signIn", async (payload: any) => {
          if (isSubscribed) {
            setWallet(payload.wallet);
            const accounts = await payload.wallet.getAccounts();
            if (accounts?.length > 0) {
              setSignedAccountId(accounts[0].accountId);
            }
          }
        });
      } catch (error) {
        console.error("Failed to initialize NEAR:", error);
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    initNear();

    return () => {
      isSubscribed = false;
    };
  }, [mounted]);

  async function signIn() {
    console.log("signIn called", { connector, wallet });
    if (!connector) {
      throw new Error("Connector not initialized (not in browser)");
    }
    try {
      const newWallet = await connector.connect();
      console.log("Connected wallet", newWallet);
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  }

  async function signOut() {
    if (!connector || !wallet) {
      throw new Error("Wallet not connected");
    }
    await connector.disconnect(wallet);
    console.log("Disconnected wallet");
  }

  async function viewFunction({
    contractId,
    method,
    args = {},
  }: ViewFunctionParams) {
    if (!provider) {
      throw new Error("Provider not initialized");
    }
    return provider.callFunction(contractId, method, args);
  }

  async function callFunction({
    contractId,
    method,
    args = {},
    gas = "30000000000000",
    deposit = "0",
  }: CallFunctionParams) {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    return wallet.signAndSendTransaction({
      receiverId: contractId,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: method,
            args,
            gas,
            deposit,
          },
        },
      ],
    });
  }

  if (!mounted) {
    return {
      signedAccountId: "",
      wallet: undefined,
      signIn: async () => {},
      signOut: async () => {},
      loading: true,
      viewFunction: async () => {},
      callFunction: async () => {},
      provider: null,
      connector: null,
    };
  }

  return {
    signedAccountId,
    wallet,
    signIn,
    signOut,
    loading,
    viewFunction,
    callFunction,
    provider,
    connector,
  };
}
