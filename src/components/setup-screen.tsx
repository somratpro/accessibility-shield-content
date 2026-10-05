import type { SetupProblem } from "@/lib/studio-config";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { CopyBlock } from "./copy-block";
import { Card } from "./ui/card";

const STARTER = `---
name: My Site
url: https://example.com
industry: what your site is about, e.g. home coffee brewing
summary: One or two sentences on what you offer and who it's for.
---`;

function Step({
  number,
  title,
  state,
  children,
}: {
  number: number;
  title: string;
  state: "done" | "current" | "later";
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn("p-5", state === "later" && "opacity-60")}>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            state === "done"
              ? "bg-success text-primary-foreground"
              : state === "current"
                ? "bg-primary text-primary-foreground"
                : "bg-light text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {state === "done" ? <Check className="h-3.5 w-3.5" /> : number}
        </span>
        <h2 className="text-sm font-semibold">
          {title}
          {state === "done" && <span className="sr-only"> (done)</span>}
        </h2>
      </div>
      {children && (
        <div className="mt-3 pl-9 text-sm text-muted-foreground">{children}</div>
      )}
    </Card>
  );
}

function Problems({ errors }: { errors: string[] }) {
  return (
    <ul className="mb-3 space-y-1 text-destructive">
      {errors.map((error, i) => (
        <li key={i} className="wrap-break-word">
          {error}
        </li>
      ))}
    </ul>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="break-all font-mono text-xs text-foreground">{children}</code>
);

/** Shown instead of the app until .env and the context file are in place. */
export function SetupScreen({ problem }: { problem: SetupProblem }) {
  const step1Done = problem.step === 2;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-12">
      {/* The page (and its metadata) isn't rendered during setup, so set the title here. */}
      <title>Content Studio · Setup</title>
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Connect your site</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two steps and you can start writing.
        </p>
      </div>

      <Step
        number={1}
        title="Fill in the basics"
        state={step1Done ? "done" : "current"}
      >
        {step1Done ? (
          <p>
            Reading posts from <Code>{problem.contentDir}</Code>
          </p>
        ) : (
          <>
            {!problem.firstRun && <Problems errors={problem.errors} />}
            <p>
              Add these to this app&apos;s <Code>.env</Code> file, then restart
              the app: the folder your site keeps its markdown posts in, and
              where your context file will be (created in step 2).
            </p>
            <CopyBlock
              label=".env lines"
              code={[
                `CONTENT_DIR="../my-site/src/content/blog"`,
                `CONTEXT_FILE="../my-site/content-context.md"`,
              ].join("\n")}
            />
          </>
        )}
      </Step>

      <Step
        number={2}
        title="Describe your site"
        state={step1Done ? "current" : "later"}
      >
        {step1Done && problem.contextExists ? (
          <>
            <p className="mb-2">
              Fix {problem.errors.length === 1 ? "this" : "these"} in{" "}
              <Code>{problem.contextFile}</Code>, then reload this page:
            </p>
            <Problems errors={problem.errors} />
          </>
        ) : step1Done ? (
          <>
            <p>
              Create <Code>{problem.contextFile}</Code> with these four lines,
              then reload this page.
            </p>
            <CopyBlock label="starter file" code={STARTER} />
            <p className="mt-3">
              That&apos;s enough to start. For better posts, add your audience,
              facts, links and categories later: see{" "}
              <Code>examples/content-context.example.md</Code>, or have a coding
              agent write the whole file with{" "}
              <Code>examples/generate-context-prompt.md</Code>.
            </p>
          </>
        ) : (
          <p>
            A short file that tells the writer about your brand: what you do,
            who reads the blog, and what never to claim.
          </p>
        )}
      </Step>
    </main>
  );
}
