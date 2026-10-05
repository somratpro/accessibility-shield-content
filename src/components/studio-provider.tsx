"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { GroqKeyDialog } from "./groq-key-dialog";

/** Public site details from .env, passed down from the server layout. */
export interface StudioSite {
  name: string;
  host: string;
  /** Leading slash, no trailing slash; "" when posts live at the site root */
  blogPath: string;
  contentDir: string;
}

interface StudioContextValue {
  site: StudioSite;
  /** Key saved in this browser; empty when relying on GROQ_API_KEY in .env */
  apiKey: string;
  hasApiKey: boolean;
  /** True once the .env key check has finished */
  ready: boolean;
  openKeyDialog: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used inside <StudioProvider>");
  return ctx;
}

export function StudioProvider({
  site,
  children,
}: {
  site: StudioSite;
  children: React.ReactNode;
}) {
  const [apiKey, setApiKey] = useState("");
  const [envKey, setEnvKey] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem("groq_api_key") || "");
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => setEnvKey(Boolean(data.groqKeyConfigured)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  return (
    <StudioContext.Provider
      value={{
        site,
        apiKey,
        hasApiKey: envKey || Boolean(apiKey),
        ready,
        openKeyDialog: () => setDialogOpen(true),
      }}
    >
      {children}
      <GroqKeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onKeySaved={setApiKey}
        usingEnvKey={envKey}
      />
    </StudioContext.Provider>
  );
}
