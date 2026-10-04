"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface GeneratorPanelProps {
  onGenerate: (data: {
    topic: string;
    customInstruction?: string;
    autoPublish: boolean;
  }) => void;
  isGenerating: boolean;
  hasApiKey: boolean;
  initialTopic?: string;
  initialInstruction?: string;
  onOpenKeyModal: () => void;
}

export function GeneratorPanel({
  onGenerate,
  isGenerating,
  hasApiKey,
  initialTopic = "",
  initialInstruction = "",
  onOpenKeyModal,
}: GeneratorPanelProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [notes, setNotes] = useState(initialInstruction);
  const [autoPublish, setAutoPublish] = useState(false);

  useEffect(() => {
    setTopic(initialTopic);
    setNotes(initialInstruction);
  }, [initialTopic, initialInstruction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasApiKey) return onOpenKeyModal();
    if (!topic.trim()) return;
    onGenerate({
      topic: topic.trim(),
      customInstruction: notes.trim() || undefined,
      autoPublish,
    });
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="topic" className="text-sm font-medium">
            Title or search query
          </label>
          <Input
            id="topic"
            placeholder="A question your readers type into Google"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes <span className="font-normal text-muted">(optional)</span>
          </label>
          <Textarea
            id="notes"
            placeholder="Angle, keywords, things to include or avoid"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Save post when done
          </label>
          <Button
            type="submit"
            isLoading={isGenerating}
            disabled={!topic.trim()}
          >
            {isGenerating
              ? "Writing…"
              : hasApiKey
                ? "Generate"
                : "Add Groq key"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
