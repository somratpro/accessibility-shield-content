"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";

interface GroqKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeySaved: (key: string) => void;
  usingEnvKey: boolean;
}

export function GroqKeyDialog({ open, onOpenChange, onKeySaved, usingEnvKey }: GroqKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (open) setApiKey(localStorage.getItem("groq_api_key") || "");
  }, [open]);

  const handleSave = async () => {
    const key = apiKey.trim();
    if (!key) return;
    setTesting(true);
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "That key didn't work");
        return;
      }
      localStorage.setItem("groq_api_key", key);
      onKeySaved(key);
      onOpenChange(false);
      toast.success("Key saved");
    } catch {
      toast.error("Couldn't verify the key");
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem("groq_api_key");
    setApiKey("");
    onKeySaved("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Groq API key">
      <div className="space-y-3">
        {usingEnvKey && (
          <p className="text-sm text-muted-foreground">
            A key is already set in <code>.env</code>. A key saved here overrides it in this browser.
          </p>
        )}
        <label htmlFor="groq-key" className="sr-only">
          Groq API key
        </label>
        <Input
          id="groq-key"
          type="password"
          placeholder="gsk_..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Stored in this browser only.{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Get a free key
          </a>
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {apiKey && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="mr-auto">
            Remove
          </Button>
        )}
        <Button size="sm" onClick={handleSave} isLoading={testing} disabled={!apiKey.trim()}>
          Save
        </Button>
      </div>
    </Dialog>
  );
}
