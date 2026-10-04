import { Header } from "@/components/header";
import { SetupScreen } from "@/components/setup-screen";
import { StudioProvider } from "@/components/studio-provider";
import { getStudioConfig } from "@/lib/studio-config";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

// Config is read from .env and the context file on every request, never at build time.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const config = getStudioConfig();
  return config.ok
    ? {
        title: `Content Studio · ${config.site.name}`,
        description: `Plan, write and publish blog posts for ${config.site.host}.`,
      }
    : { title: "Content Studio · Setup" };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = getStudioConfig();

  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        {config.ok ? (
          <StudioProvider
            site={{
              name: config.site.name,
              host: config.site.host,
              blogPath: config.site.blogPath,
              outputDir: config.site.outputDir,
            }}
          >
            <Header />
            <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
          </StudioProvider>
        ) : (
          <SetupScreen errors={config.errors} />
        )}
        <Toaster position="bottom-right" theme="system" />
      </body>
    </html>
  );
}
