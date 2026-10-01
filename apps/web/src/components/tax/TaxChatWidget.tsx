"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { sendChatMessage } from "@/lib/tax/api";
import type { ChatMessage, TaxComparisonResult } from "@/lib/tax/types";

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hi! Ask me anything about this calculation, tax rules, or the filing process.",
};

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
          isUser ? "bg-accent text-accent-foreground" : "bg-surface-muted text-foreground",
        )}
      >
        {message.content}
      </p>
    </div>
  );
}

export function TaxChatWidget({ comparison }: { comparison?: TaxComparisonResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");

  const mutation = useMutation({
    mutationFn: (nextMessages: ChatMessage[]) =>
      sendChatMessage({ comparison, messages: nextMessages }),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || mutation.isPending) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    mutation.mutate(nextMessages, {
      onSuccess: (response) => {
        setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Couldn't reach the assistant — check your connection and try again.",
          },
        ]);
      },
    });
  }

  function handleClear() {
    setMessages([GREETING]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close tax assistant" : "Open tax assistant"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg hover:opacity-90"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {isOpen && (
        <Card className="fixed bottom-24 right-6 z-50 flex w-96 max-w-[calc(100vw-3rem)] flex-col gap-0 p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-body font-semibold text-foreground">Tax Assistant</h3>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>

          <div className="flex max-h-96 min-h-64 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <Bubble key={index} message={message} />
            ))}
            {mutation.isPending && (
              <div className="flex justify-start">
                <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted">
                  Thinking…
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              disabled={mutation.isPending}
            />
            <button
              type="submit"
              disabled={mutation.isPending || !input.trim()}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
            >
              Send
            </button>
          </form>

          <p className="border-t border-border px-4 py-2 text-xs text-muted">
            General tax information, not professional advice. Rules may have changed — verify
            before filing.
          </p>
        </Card>
      )}
    </>
  );
}
