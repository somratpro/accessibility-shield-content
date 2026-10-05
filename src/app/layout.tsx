import { ThemeProvider } from "@/components/providers/theme-provider";
import { Header } from "@/components/header";
import { SetupScreen } from "@/components/setup-screen";
import { StudioProvider } from "@/components/studio-provider";
import { getStudioConfig } from "@/lib/studio-config";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@/styles/main.css";

// Config is read from .env and the context file on every request, never at build time.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const config = getStudioConfig();
  return config.ok
    ? {
        title: `Content Studio · ${config.site.name}`,
        description: `Plan, write and publish blog posts for ${config.site.host}.`,
      }
    : {};
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = getStudioConfig();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          {config.ok ? (
            <StudioProvider
              site={{
                name: config.site.name,
                host: config.site.host,
                blogPath: config.site.blogPath,
                contentDir: config.site.contentDir,
              }}
            >
              <Header />
              <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
            </StudioProvider>
          ) : (
            <SetupScreen problem={config} />
          )}
          <Toaster position="bottom-right" theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}
