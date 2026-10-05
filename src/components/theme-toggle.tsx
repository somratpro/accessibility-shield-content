"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "./ui/button";

type Mode = "system" | "light" | "dark";

const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Mode, string> = { system: "System", light: "Light", dark: "Dark" };
const ICON = { system: Monitor, light: Sun, dark: Moon };

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const mode: Mode = theme === "light" || theme === "dark" ? theme : "system";
  const Icon = ICON[mode];

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(NEXT[mode])}
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}`}
      title={`Theme: ${LABEL[mode]}`}
      className="shrink-0 px-2"
    >
      {mounted ? <Icon className="h-4 w-4" aria-hidden="true" /> : <span className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
