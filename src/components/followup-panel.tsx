"use client";

import { ContentResult } from "@/types/content";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface FollowupPanelProps {
  content: ContentResult;
  onFollowupApplied: (updated: ContentResult) => void;
  apiKey?: string;
}

export function FollowupPanel({ content, onFollowupApplied, apiKey }: FollowupPanelProps) {
  const [instruction, setInstruction] = useState("");
  const [isRevising, setIsRevising] = useState(false);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim()) return;
    setIsRevising(true);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingContent: content, instruction: instruction.trim(), apiKey }),
      });
      const data = await res.json();
      if (!data.success || !data.result) throw new Error(data.error || "Revision failed");
      onFollowupApplied(data.result);
      setInstruction("");
      toast.success("Revised");
    } catch (err: any) {
      toast.error(err?.message || "Revision failed");
    } finally {
      setIsRevising(false);
    }
  };

  return (
    <form onSubmit={handleApply} className="flex gap-2">
      <label htmlFor="revise" className="sr-only">
        Revision instruction
      </label>
      <Input
        id="revise"
        placeholder="Ask for a change, e.g. add an example to step 3"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
      />
      <Button type="submit" variant="outline" isLoading={isRevising} disabled={!instruction.trim()}>
        Revise
      </Button>
    </form>
  );
}
