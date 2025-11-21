// components/chat/Chatbot.tsx
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import MarkdownIt from "markdown-it";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { extractVerificationMetadata } from "@/utils/verification";
import {
  extractExpectationsFromMessage,
  type PartialExpectations,
} from "@/utils/attestation-expectations";
import type { RemoteProof } from "@/components/verification/VerificationProof";
import type { VerificationMetadata } from "@/types/agui-events";
import type { AgentUIEvent } from "@/types/agent-ui";

// Import all types (keeping your existing type definitions)
type AgentRole = "user" | "assistant" | "system";
type ToolCallStatus = "pending" | "running" | "completed" | "failed";
type StatusLevel = "info" | "success" | "warning" | "error";
type SubAgentPhase = "spawned" | "running" | "completed" | "failed";

interface BaseAgentEvent {
  id: string;
  kind: "message" | "tool_call" | "tool_result" | "status" | "sub_agent";
  timestamp: Date;
  turnNumber?: number;
}

interface MessageEvent extends BaseAgentEvent {
  kind: "message";
  role: AgentRole;
  content: string;
  status?: "in_progress" | "completed";
  messageId?: string;
  verification?: VerificationMetadata;
  proof?: MessageProof;
  remoteProof?: RemoteProof | null;
}

interface ToolCallEvent extends BaseAgentEvent {
  kind: "tool_call";
  toolName: string;
  input?: unknown;
  status: ToolCallStatus;
  verification?: VerificationMetadata;
}

interface ToolResultEvent extends BaseAgentEvent {
  kind: "tool_result";
  toolName: string;
  output?: unknown;
  status: ToolCallStatus;
  toolCallId?: string;
  messageId?: string;
  verification?: VerificationMetadata;
}

interface StatusEvent extends BaseAgentEvent {
  kind: "status";
  label: string;
  detail?: string;
  level: StatusLevel;
}

interface SubAgentEvent extends BaseAgentEvent {
  kind: "sub_agent";
  agentName: string;
  phase: SubAgentPhase;
  detail?: string;
}

type AgentEvent =
  | MessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | StatusEvent
  | SubAgentEvent;

interface MessageDelta {
  kind: "message_delta";
  contentChunk: string;
  messageId?: string;
  role?: AgentRole;
  verification?: VerificationMetadata;
  proof?: MessageProof;
}

interface MessageProof extends PartialExpectations {
  requestHash?: string;
  responseHash?: string;
  verificationId?: string;
  nonce?: string;
}

interface ChatbotProps {
  model?: string;
  className?: string;
  placeholder?: string;
  welcomeMessage?: string;
}

const generateEventId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const SESSION_STORAGE_KEY = "chatbot_session_v1";
const toTimestamp = (value?: string | number) =>
  value ? new Date(value) : new Date();

const toToolStatus = (status?: string): ToolCallStatus => {
  switch (status) {
    case "pending":
    case "running":
    case "completed":
    case "failed":
      return status;
    default:
      return "running";
  }
};

const toStatusLevel = (level?: string): StatusLevel => {
  switch (level) {
    case "success":
    case "warning":
    case "error":
      return level;
    default:
      return "info";
  }
};

const toSubAgentPhase = (phase?: string): SubAgentPhase => {
  switch (phase) {
    case "spawned":
    case "running":
    case "completed":
    case "failed":
      return phase;
    default:
      return "spawned";
  }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractText = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => extractText(item)).join("");
  }
  if (typeof value === "object") {
    if (
      "text" in value &&
      typeof (value as { text?: unknown }).text === "string"
    ) {
      return (value as { text: string }).text;
    }
    if ("content" in value) {
      return extractText((value as { content?: unknown }).content);
    }
  }
  return "";
};

const serializeToolInput = (input?: unknown): string | undefined => {
  if (input === undefined || input === null) return undefined;
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled agent event: ${JSON.stringify(value)}`);
};

const convertAgentEventToUIEvent = (event: AgentEvent): AgentUIEvent => {
  const turnNumber = event.turnNumber ?? 0;
  const timestamp =
    event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp);

  switch (event.kind) {
    case "message": {
      const status =
        event.status ??
        (event.role === "assistant" && !event.content
          ? "in_progress"
          : "completed");

      return {
        id: event.id,
        kind: "message",
        role: event.role,
        content: event.content,
        status,
        messageId: event.messageId,
        verification: event.verification,
        proof: event.proof,
        remoteProof: event.remoteProof ?? null,
        turnNumber,
        timestamp,
      };
    }
    case "tool_call":
      return {
        id: event.id,
        kind: "tool_call",
        toolCallId: event.id,
        toolName: event.toolName,
        input: serializeToolInput(event.input),
        status: event.status ?? "pending",
        turnNumber,
        timestamp,
      };
    case "tool_result":
      return {
        id: event.id,
        kind: "tool_result",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        output: event.output,
        status: event.status ?? "completed",
        turnNumber,
        timestamp,
      };
    case "status":
      return {
        id: event.id,
        kind: "status",
        label: event.label,
        detail: event.detail,
        level: event.level ?? "info",
        turnNumber,
        timestamp,
      };
    case "sub_agent":
      return {
        id: event.id,
        kind: "sub_agent",
        agentName: event.agentName,
        phase: event.phase,
        detail: event.detail,
        turnNumber,
        timestamp,
      };
  }
  return assertNever(event);
};

export const Chatbot = ({
  model = "openai/gpt-oss-120b",
  className = "",
  placeholder = "Ask me anything...",
  welcomeMessage = "Welcome to NEAR AI Assistant. How can I help you today?",
}: ChatbotProps) => {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [inputHeight, setInputHeight] = useState(220);

  const hasHydratedRef = useRef(false);
  const streamingAssistantIdRef = useRef<string | null>(null);
  const conversationHistoryRef = useRef<
    Array<{ role: string; content: string }>
  >([]);
  const turnCounterRef = useRef(0);
  const activeTurnRef = useRef(0);

  const markdown = useMemo(
    () =>
      new MarkdownIt({
        html: false,
        linkify: true,
        breaks: true,
      }),
    []
  );

  const handleNearBottomChange = (nearBottom: boolean) => {
    setIsAtBottom(nearBottom);
  };

  // Focus input on mount
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Load cached session
  useEffect(() => {
    if (typeof window === "undefined" || hasHydratedRef.current) return;
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        events?: AgentEvent[];
        history?: Array<{ role: string; content: string }>;
      };

      if (Array.isArray(parsed?.history)) {
        conversationHistoryRef.current = parsed.history;
      }

      if (Array.isArray(parsed?.events)) {
        const hydratedEvents = parsed.events.map((event) => ({
          ...event,
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        }));
        setEvents(hydratedEvents);
        const lastTurn = hydratedEvents.reduce(
          (max, event) => Math.max(max, event.turnNumber ?? 0),
          0
        );
        turnCounterRef.current = Math.max(
          lastTurn,
          conversationHistoryRef.current.length
        );
        activeTurnRef.current = turnCounterRef.current;
      } else {
        turnCounterRef.current = conversationHistoryRef.current.length;
        activeTurnRef.current = turnCounterRef.current;
      }

      hasHydratedRef.current = true;
    } catch (error) {
      console.error("Failed to load cached chat session:", error);
    }
  }, []);

  // Persist session when events change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          events,
          history: conversationHistoryRef.current,
        })
      );
    } catch (error) {
      console.warn("Failed to persist chat session:", error);
    }
  }, [events]);

  const addEvent = (event: AgentEvent) => {
    setEvents((prev) => [...prev, event]);
  };

  const upsertEvent = (incoming: AgentEvent) => {
    setEvents((prev) => {
      const index = prev.findIndex((event) => event.id === incoming.id);
      if (index === -1) {
        return [...prev, incoming];
      }
      const updated = [...prev];
      const existing = updated[index];

      if (!existing || existing.kind !== incoming.kind) {
        updated[index] = incoming;
        return updated;
      }

      if (incoming.kind === "message" && existing.kind === "message") {
        updated[index] = { ...existing, ...incoming };
      } else if (
        incoming.kind === "tool_call" &&
        existing.kind === "tool_call"
      ) {
        updated[index] = { ...existing, ...incoming };
      } else if (
        incoming.kind === "tool_result" &&
        existing.kind === "tool_result"
      ) {
        updated[index] = { ...existing, ...incoming };
      } else if (incoming.kind === "status" && existing.kind === "status") {
        updated[index] = { ...existing, ...incoming };
      } else if (
        incoming.kind === "sub_agent" &&
        existing.kind === "sub_agent"
      ) {
        updated[index] = { ...existing, ...incoming };
      } else {
        updated[index] = incoming;
      }

      return updated;
    });
  };

  interface UpdateMessageData {
    content?: string;
    messageId?: string;
    verification?: VerificationMetadata;
    proof?: MessageProof;
    remoteProof?: RemoteProof | null;
    status?: "in_progress" | "completed";
  }

  const updateMessageEvent = (id: string, data: UpdateMessageData) => {
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== id || event.kind !== "message") {
          return event;
        }

        const next: MessageEvent = { ...event };

        if (data.content !== undefined) {
          next.content = data.content;
        }

        if (data.messageId !== undefined) {
          next.messageId = data.messageId;
        }

        if (data.verification) {
          next.verification = {
            ...(event.verification ?? {
              source: "near-ai-cloud",
              status: "pending",
            }),
            ...data.verification,
          };
        }

        if (data.proof) {
          next.proof = {
            ...(event.proof ?? {}),
            ...data.proof,
          };
        }

        if (data.remoteProof !== undefined) {
          next.remoteProof = data.remoteProof;
        }

        if (data.status) {
          next.status = data.status;
        }

        if (!next.status) {
          next.status =
            next.role === "assistant" && !next.content
              ? "in_progress"
              : "completed";
        }

        return next;
      })
    );
  };

  const removeEventById = (id: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== id));
  };

  const fetchProofForMessage = async (
    verificationId: string,
    eventId: string,
    proof: MessageProof
  ) => {
    const syncVerificationSession = async () => {
      const callSessionEndpoint = async () => {
        const sessionResp = await fetch("/api/verification/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verificationId,
            requestHash: proof.requestHash,
            responseHash: proof.responseHash,
          }),
        });
        if (!sessionResp.ok) {
          const text = await sessionResp.text();
          throw new Error(text || "Failed to register verification session");
        }
      };

      try {
        await callSessionEndpoint();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to register verification session";
        if (!message.toLowerCase().includes("not registered")) {
          throw error instanceof Error ? error : new Error(message);
        }

        const registerResp = await fetch("/api/verification/register-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verificationId }),
        });
        if (!registerResp.ok) {
          const text = await registerResp.text();
          throw new Error(text || "Failed to register verification session");
        }

        await callSessionEndpoint();
      }
    };

    try {
      await syncVerificationSession();
    } catch (sessionError) {
      console.error("Failed to register verification session:", sessionError);
      toast.error("Unable to register verification session", {
        description:
          sessionError instanceof Error
            ? sessionError.message
            : "Unknown session error",
      });
      return;
    }

    updateMessageEvent(eventId, {
      verification: {
        source: "near-ai-cloud",
        status: "pending",
        messageId: verificationId,
      },
    });

    const requestProof = async () => {
      const resp = await fetch("/api/verification/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId,
          model,
          requestHash: proof.requestHash,
          responseHash: proof.responseHash,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Failed to fetch verification proof");
      }
      return (await resp.json()) as RemoteProof;
    };

    try {
      let remoteProof: RemoteProof | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          remoteProof = await requestProof();
          break;
        } catch (attemptError) {
          const message =
            attemptError instanceof Error
              ? attemptError.message
              : "Failed to fetch verification proof";
          const needsSession =
            attempt === 0 &&
            message.toLowerCase().includes("verification session not registered");
          if (needsSession) {
            await syncVerificationSession();
            continue;
          }
          throw attemptError;
        }
      }

      if (!remoteProof) {
        throw new Error("Failed to fetch verification proof");
      }

      updateMessageEvent(eventId, {
        verification: {
          source: "near-ai-cloud",
          status: "verified",
          messageId: verificationId,
        },
        remoteProof,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch verification proof";
      console.error("Automatic proof fetch failed:", error);

      updateMessageEvent(eventId, {
        verification: {
          source: "near-ai-cloud",
          status: "failed",
          messageId: verificationId,
          error: message,
        },
      });

      toast.error("Unable to load verification proof", {
        description: message,
      });
    }
  };

  const normalizeAgUiEvent = (
    payload: Record<string, any>
  ): AgentEvent | MessageDelta | null => {
    // Keep your existing implementation
    if (!payload || typeof payload !== "object") return null;

    const envelopeCandidates = [
      payload.event,
      payload.ag_event,
      payload.data?.event,
      payload.payload,
    ];

    const envelope = envelopeCandidates.find(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        ("type" in candidate || "kind" in candidate)
    ) as Record<string, any> | undefined;

    const eventType =
      envelope?.type || envelope?.kind || payload.event_type || payload.type;

    if (!eventType) {
      const content = payload.choices?.[0]?.delta?.content;
      if (content) {
        return {
          kind: "message_delta",
          contentChunk: extractText(content),
          messageId: payload.id,
        };
      }
      return null;
    }

    const timestamp = envelope?.timestamp || payload.timestamp || Date.now();

    const extractProofFields = (): MessageProof | undefined => {
      const expectations = extractExpectationsFromMessage({
        ...payload,
        envelope,
      });

      const requestHash =
        (payload.proof as any)?.requestHash ||
        (payload.data?.proof as any)?.requestHash ||
        (payload as any)?.requestHash ||
        (envelope as any)?.requestHash;
      const responseHash =
        (payload.proof as any)?.responseHash ||
        (payload.data?.proof as any)?.responseHash ||
        (payload as any)?.responseHash ||
        (envelope as any)?.responseHash;

      if (Object.keys(expectations).length || requestHash || responseHash) {
        return {
          ...expectations,
          requestHash,
          responseHash,
        };
      }
      return undefined;
    };

    switch (eventType) {
      case "message.delta":
      case "message":
      case "agent_output":
      case "assistant_message": {
        const content =
          envelope?.delta ??
          envelope?.content ??
          payload.delta ??
          payload.content ??
          payload.choices?.[0]?.delta?.content;

        if (!content) return null;

        const verification = extractVerificationMetadata(payload, envelope);
        const proof = extractProofFields();

        return {
          kind: "message_delta",
          contentChunk: extractText(content),
          messageId:
            envelope?.id ?? envelope?.message_id ?? payload.id ?? undefined,
          role: (envelope?.role || payload.role || "assistant") as AgentRole,
          verification,
          proof,
        };
      }
      case "tool_call":
      case "tool-start":
      case "tool_call_started":
        return {
          kind: "tool_call",
          id: envelope?.id || payload.id || generateEventId(),
          toolName:
            envelope?.tool?.name ||
            envelope?.name ||
            envelope?.toolName ||
            "Tool call",
          input: envelope?.tool?.input || envelope?.input || envelope?.payload,
          status: toToolStatus(envelope?.status),
          timestamp: toTimestamp(timestamp),
        };
      case "tool_result":
      case "tool-finish":
      case "tool_call_completed":
      case "tool_call_result":
        return {
          kind: "tool_result",
          id: envelope?.id || payload.id || generateEventId(),
          toolName:
            envelope?.tool?.name ||
            envelope?.name ||
            envelope?.toolName ||
            "Tool result",
          toolCallId:
            envelope?.tool_call_id ||
            envelope?.toolCallId ||
            envelope?.tool_call?.id ||
            envelope?.parent_id,
          output:
            envelope?.tool?.output ||
            envelope?.output ||
            envelope?.result ||
            envelope?.data,
          status: toToolStatus(envelope?.status || "completed"),
          timestamp: toTimestamp(timestamp),
        };
      case "status":
      case "agent_status":
        return {
          kind: "status",
          id: envelope?.id || payload.id || generateEventId(),
          label:
            envelope?.label ||
            envelope?.title ||
            envelope?.status ||
            "Status update",
          detail: envelope?.detail || envelope?.message,
          level: toStatusLevel(envelope?.level),
          timestamp: toTimestamp(timestamp),
        };
      case "sub_agent":
      case "agent_lifecycle":
      case "agent_spawned":
        return {
          kind: "sub_agent",
          id: envelope?.id || payload.id || generateEventId(),
          agentName:
            envelope?.agent_name ||
            envelope?.agent ||
            envelope?.name ||
            "Sub-agent",
          phase: toSubAgentPhase(envelope?.phase || envelope?.status),
          detail: envelope?.detail || envelope?.message,
          timestamp: toTimestamp(timestamp),
        };
      default: {
        const content = payload.choices?.[0]?.delta?.content;
        if (content) {
          return {
            kind: "message_delta",
            contentChunk: extractText(content),
            messageId: payload.id,
          };
        }
        return null;
      }
    }
  };

  const sendStreamingMessage = async (userMessage: string) => {
    // Keep your existing implementation
    let fullContent = "";
    let messageId: string | undefined;
    const assistantEventId = generateEventId();
    const maxAttempts = 3;
    const baseBackoff = 750;
    let responseRaw = "";
    const proofData: MessageProof = {};
    const currentTurnNumber =
      activeTurnRef.current || turnCounterRef.current || 0;

    streamingAssistantIdRef.current = assistantEventId;

    addEvent({
      kind: "message",
      id: assistantEventId,
      role: "assistant",
      content: "",
      status: "in_progress",
      turnNumber: currentTurnNumber,
      timestamp: new Date(),
    });

    const verificationId = `chatcmpl-${crypto.randomUUID()}`;

    // Register session to get server-generated nonce
    const sessionResp = await fetch("/api/verification/register-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationId }),
    });
    if (!sessionResp.ok) {
      throw new Error("Failed to register verification session");
    }
    const { nonce } = await sessionResp.json();

    // Build the EXACT request body that NEAR AI will hash (no verification fields)
    const nearAiRequestBody = {
      model,
      messages: conversationHistoryRef.current,
      stream: true,
    };

    const nearAiRequestString = JSON.stringify(nearAiRequestBody);
    proofData.nonce = nonce;
    proofData.verificationId = verificationId;

    // Full body for our proxy (includes verification fields for routing)
    const proxyRequestBody = {
      ...nearAiRequestBody,
      verificationId,
      verificationNonce: nonce,
    };

    const requestPayload = JSON.stringify(proxyRequestBody);

      console.log("[verification] Sending request:", {
        verificationId,
        nonce,
        requestLength: nearAiRequestString.length,
        proxyRequestLength: requestPayload.length,
      });

    const streamOnce = async (skipChars: number) => {
      let rawResponseText = "";
      let buffer = "";
      const response = await fetch("/api/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestPayload,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          `API Error: ${response.status} - ${
            errorData.error || errorData.message || response.statusText
          }`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not readable");

      const decoder = new TextDecoder();
      let remainingSkip = skipChars;

      const handlePayload = (payload: Record<string, any>) => {
        const normalized = normalizeAgUiEvent(payload);
        if (!normalized) return;
        if (normalized.kind === "message_delta") {
          if (!messageId && normalized.messageId) {
            messageId = normalized.messageId;
          }
          let chunk = normalized.contentChunk || "";

          if (remainingSkip > 0 && chunk.length > 0) {
            if (chunk.length <= remainingSkip) {
              remainingSkip -= chunk.length;
              chunk = "";
            } else {
              chunk = chunk.slice(remainingSkip);
              remainingSkip = 0;
            }
          }

          const updateData: UpdateMessageData = {};

          if (chunk) {
            fullContent += chunk;
            updateData.content = fullContent;
          }

          if (messageId || normalized.messageId) {
            updateData.messageId = messageId || normalized.messageId;
          }

          if (normalized.verification) {
            updateData.verification = {
              ...normalized.verification,
              messageId:
                normalized.verification.messageId ||
                messageId ||
                normalized.messageId,
            };
          }

          if (normalized.proof) {
            Object.assign(proofData, normalized.proof);
            updateData.proof = {
              ...(updateData.proof ?? {}),
              ...normalized.proof,
            };
          }

          if (
            updateData.content !== undefined ||
            updateData.messageId !== undefined ||
            updateData.verification ||
            updateData.proof
          ) {
            updateData.status = "in_progress";
            updateMessageEvent(assistantEventId, updateData);
          }
          return;
        }

        const targetTurnNumber =
          normalized.turnNumber ??
          activeTurnRef.current ??
          turnCounterRef.current ??
          0;
        upsertEvent({ ...normalized, turnNumber: targetTurnNumber });
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        rawResponseText += chunk;
        buffer += chunk;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6); // DO NOT trim; preserve formatting

            if (!data || data.trim() === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              handlePayload(parsed);
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      const finalChunk = decoder.decode();
      rawResponseText += finalChunk;
      buffer += finalChunk;
      responseRaw = rawResponseText;

      console.log("[verification] Stream complete:", {
        verificationId,
        rawResponseLength: rawResponseText.length,
        rawResponsePreview: {
          first100: rawResponseText.substring(0, 100),
          last100: rawResponseText.substring(
            Math.max(0, rawResponseText.length - 100)
          ),
        },
        endsWithNewlines: rawResponseText.endsWith("\n\n"),
      });
    };

    try {
      let attempt = 0;
      while (attempt < maxAttempts) {
        try {
          await streamOnce(fullContent.length);
          break;
        } catch (error) {
          attempt += 1;
          if (attempt >= maxAttempts) {
            throw error;
          }

          addEvent({
            kind: "status",
            id: generateEventId(),
            label: "Reconnecting to NEAR AI Cloud",
            detail: `Attempt ${attempt + 1} of ${maxAttempts}`,
            level: "warning",
            turnNumber: activeTurnRef.current || turnCounterRef.current || 0,
            timestamp: new Date(),
          });

          await delay(baseBackoff * attempt);
        }
      }

      if (fullContent) {
        conversationHistoryRef.current.push({
          role: "assistant",
          content: fullContent,
        });
        updateMessageEvent(assistantEventId, { status: "completed" });
      } else {
        // Drop empty assistant messages to avoid blank bubbles/pills
        removeEventById(assistantEventId);
        return;
      }

      if (messageId) {
        fetchProofForMessage(messageId, assistantEventId, proofData);
      }
    } catch (error: unknown) {
      removeEventById(assistantEventId);
      throw error;
    } finally {
      streamingAssistantIdRef.current = null;
    }
  };

  const handleSend = async (message: string) => {
    const nextTurnNumber = turnCounterRef.current + 1;
    turnCounterRef.current = nextTurnNumber;
    activeTurnRef.current = nextTurnNumber;

    addEvent({
      kind: "message",
      id: generateEventId(),
      role: "user",
      content: message,
      status: "completed",
      turnNumber: nextTurnNumber,
      timestamp: new Date(),
    });
    conversationHistoryRef.current.push({ role: "user", content: message });

    setIsLoading(true);
    setError(null);

    try {
      await sendStreamingMessage(message);
    } catch (error: unknown) {
      const messageText =
        error instanceof Error ? error.message : "Failed to get response";
      setError(messageText);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm("Clear chat history?")) {
      setEvents([]);
      conversationHistoryRef.current = [];
      setError(null);
      streamingAssistantIdRef.current = null;
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  };

  const shouldShowTypingIndicator = Boolean(
    isLoading &&
      streamingAssistantIdRef.current &&
      events.some(
        (event) =>
          event.id === streamingAssistantIdRef.current &&
          event.kind === "message" &&
          event.role === "assistant" &&
          event.content.length === 0
      )
  );

  const uiEvents = useMemo<AgentUIEvent[]>(
    () => events.map((event) => convertAgentEventToUIEvent(event)),
    [events]
  );

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="flex-1 min-h-0">
        <ChatMessages
          events={uiEvents}
          isLoading={isLoading}
          isInitialized={isInitialized}
          showTypingIndicator={shouldShowTypingIndicator}
          welcomeMessage={welcomeMessage}
          model={model}
          markdown={markdown}
          isAtBottom={isAtBottom}
          onNearBottomChange={handleNearBottomChange}
          bottomOffset={inputHeight}
        />
      </div>

      <ChatInput
        onSend={handleSend}
        onClear={clearChat}
        isLoading={isLoading}
        error={error}
        placeholder={placeholder}
        canClear={events.length > 0}
        onHeightChange={setInputHeight}
      />
    </div>
  );
};
