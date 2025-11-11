import { Chatbot } from "@/components/chat/Chatbot";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">AI Chat Assistant</h1>
          <p className="text-muted-foreground">
            Ask questions about NEAR governance, proposals, and platform
            features
          </p>
        </div>

        <Chatbot
          welcomeMessage="I can help you understand NEAR governance proposals, explain platform features, or answer questions about the screening process."
          placeholder="Ask me about NEAR governance..."
        />

        <Card className="mt-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <Shield className="h-5 w-5" />
              Privacy & Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-green-700">
              All conversations are private and run in Trusted Execution
              Environments (TEEs). Responses are cryptographically verifiable.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
