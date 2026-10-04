"use client";

import { CalendarTopic } from "@/lib/ai/calendar-generator";
import { CalendarGenerationContext, ContentResult } from "@/types/content";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FollowupPanel } from "./followup-panel";
import { GeneratorPanel } from "./generator-panel";
import { PreviewTabs } from "./preview-tabs";
import { ProgressMonitor } from "./progress-monitor";
import { useStudio } from "./studio-provider";

interface GenerateParams {
  topic: string;
  customInstruction?: string;
  autoPublish?: boolean;
  calendar?: CalendarGenerationContext;
}

/** Reads the /api/generate server-sent event stream. */
async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (type: string, data: any) => Promise<void> | void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const type = part.match(/^event:\s*(.+)$/m)?.[1]?.trim() || "message";
      const data = part.match(/^data:\s*(.+)$/m)?.[1];
      if (data) await onEvent(type, JSON.parse(data));
    }
  }
}

function calendarInstruction(topic: CalendarTopic) {
  return `Why this article: ${topic.rationale}\nSearch intent: ${topic.searchIntent}\nTarget keywords: ${topic.keywords.join(", ")}`;
}

export function WriteStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiKey, hasApiKey, ready, openKeyDialog } = useStudio();

  const [draft, setDraft] = useState({ topic: "", instruction: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContentResult | null>(null);

  const savePost = async (content: ContentResult) => {
    const data = await fetch("/api/save-to-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: content.filename, content: content.markdown_with_frontmatter }),
    }).then((r) => r.json());
    if (!data.success) throw new Error(data.error || "Save failed");
    toast.success(`Saved ${content.filename}`);
  };

  const generate = async (params: GenerateParams) => {
    if (!hasApiKey) return openKeyDialog();
    setIsGenerating(true);
    setSteps([]);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: params.topic,
          customInstruction: params.customInstruction,
          apiKey: apiKey || undefined,
          calendar: params.calendar,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      await readEventStream(res.body, async (type, data) => {
        if (type === "step") setSteps((prev) => [...prev, data.step]);
        if (type === "error") throw new Error(data.message);
        if (type === "result") {
          setResult(data);
          if (params.autoPublish) await savePost(data);
        }
      });
    } catch (err: any) {
      setError(err?.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // Opened from the calendar (/write?topic=<id>): load that topic and start the draft once.
  const topicId = searchParams.get("topic");
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!topicId || !ready || startedFor.current === topicId) return;
    startedFor.current = topicId;
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data) => {
        const topic: CalendarTopic | undefined = data.topics?.find(
          (t: CalendarTopic) => t.id === topicId,
        );
        if (!topic) return toast.error("That calendar topic no longer exists");
        const instruction = calendarInstruction(topic);
        setDraft({ topic: topic.title, instruction });
        router.replace("/write"); // a refresh shouldn't start another draft
        if (!hasApiKey) return openKeyDialog();
        generate({
          topic: topic.title,
          customInstruction: instruction,
          calendar: { slug: topic.slug, keywords: topic.keywords, category: topic.category },
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, ready]);

  return (
    <section className="space-y-6">
      <h1 className="text-lg font-semibold">Write</h1>
      <GeneratorPanel
        onGenerate={generate}
        isGenerating={isGenerating}
        hasApiKey={hasApiKey}
        initialTopic={draft.topic}
        initialInstruction={draft.instruction}
        onOpenKeyModal={openKeyDialog}
      />
      <ProgressMonitor steps={steps} isGenerating={isGenerating} error={error} />
      {result && (
        <>
          <FollowupPanel content={result} onFollowupApplied={setResult} apiKey={apiKey} />
          <PreviewTabs content={result} onSave={() => savePost(result)} />
        </>
      )}
    </section>
  );
}
