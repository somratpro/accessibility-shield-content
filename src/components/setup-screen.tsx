import { Card } from "./ui/card";

const STEPS = [
  <>
    Copy <code>.env.example</code> to <code>.env</code> and fill in{" "}
    <code>SITE_NAME</code>, <code>SITE_URL</code>, <code>CONTENT_OUTPUT_DIR</code> and{" "}
    <code>CONTENT_CONTEXT_FILE</code>.
  </>,
  <>
    Copy <code>examples/content-context.example.md</code> to the path in{" "}
    <code>CONTENT_CONTEXT_FILE</code> and describe your brand, audience, facts and links.
  </>,
  <>Restart the dev server after changing <code>.env</code>. Context file edits apply on the next page load.</>,
];

/** Shown instead of the app when .env or the context file is missing or invalid. */
export function SetupScreen({ errors }: { errors: string[] }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-lg font-semibold">Content Studio needs setup</h1>
      <p className="mt-1 text-sm text-muted">
        Fix the {errors.length === 1 ? "problem" : `${errors.length} problems`} below, then reload this page.
      </p>

      <Card className="mt-6 p-4">
        <ul className="space-y-2 text-sm">
          {errors.map((error, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-danger" aria-hidden="true">
                •
              </span>
              <span className="break-words">{error}</span>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mt-8 text-sm font-semibold">How to set it up</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted [&_code]:font-mono [&_code]:text-fg">
        {STEPS.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </main>
  );
}
