import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auditContentForAntiAI } from "@/lib/ai/content-optimizer";
import { getSavedIdeas } from "@/lib/ai/idea-generator";
import { expectedImpact, IMPACT_STYLE, openIdeasByImpact } from "@/lib/ideas";
import { postIssues } from "@/lib/post-issues";
import {
  getExistingBlogPostBySlug,
  getExistingBlogPosts,
} from "@/lib/posts-store";
import { getBlogSearchPerformance } from "@/lib/search-console";
import { requireStudioConfig } from "@/lib/studio-config";
import { cn } from "@/lib/utils";
import Link from "next/link";

const DAY_MS = 24 * 60 * 60 * 1000;

const compact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function StatTile({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {detail && (
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      )}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-background p-4 transition-colors hover:bg-light"
    >
      {body}
    </Link>
  ) : (
    <Card className="p-4">{body}</Card>
  );
}

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const { site } = requireStudioConfig();
  const posts = getExistingBlogPosts();
  const ideas = openIdeasByImpact(getSavedIdeas());
  const search = await getBlogSearchPerformance();

  const needCleanup = posts
    .map((p) => {
      const full = getExistingBlogPostBySlug(p.slug);
      return {
        post: p,
        issues: postIssues(
          full ? auditContentForAntiAI(full.rawMarkdown) : null,
        ),
      };
    })
    .filter((p) => p.issues.length > 0);

  const dated = posts.filter((p) => p.date);
  const lastPost = dated[0];
  const recentCount = dated.filter(
    (p) => Date.now() - new Date(p.date!).getTime() <= 30 * DAY_MS,
  ).length;
  const highImpact = ideas.filter(
    (i) => expectedImpact(i).level === "High",
  ).length;

  const gsc =
    search.configured && !search.error ? Object.entries(search.pages) : null;
  const titles = new Map(posts.map((p) => [p.slug, p.title]));
  const clicks = gsc?.reduce((sum, [, p]) => sum + p.clicks, 0) ?? 0;
  const impressions = gsc?.reduce((sum, [, p]) => sum + p.impressions, 0) ?? 0;
  const position = impressions
    ? (gsc ?? []).reduce((sum, [, p]) => sum + p.position * p.impressions, 0) /
      impressions
    : 0;
  const topPosts = (gsc ?? [])
    .filter(([slug]) => titles.has(slug))
    .sort(
      ([, a], [, b]) => b.clicks - a.clicks || b.impressions - a.impressions,
    )
    .slice(0, 5);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {site.host}
          {site.blogPath}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Published posts"
          value={posts.length.toLocaleString()}
          detail={`${recentCount} in the last 30 days`}
          href="/posts"
        />
        <StatTile
          label="Last post"
          value={lastPost ? daysAgo(lastPost.date!) : "None yet"}
          detail={lastPost ? formatDate(lastPost.date!) : undefined}
        />
        <StatTile
          label="Ideas to write"
          value={ideas.length.toLocaleString()}
          detail={
            ideas.length
              ? `${highImpact} high impact`
              : "Add ideas to get started"
          }
          href="/ideas"
        />
        <StatTile
          label="Posts to clean up"
          value={needCleanup.length.toLocaleString()}
          detail={
            needCleanup.length ? `of ${posts.length} posts` : "All posts pass"
          }
          href="/posts"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <SectionHeader
            title="Write next"
            href="/ideas"
            linkLabel="All ideas"
          />
          {ideas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No ideas yet.{" "}
              <Link
                href="/ideas"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Add some
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {ideas.slice(0, 3).map((idea) => {
                const impact = expectedImpact(idea);
                return (
                  <li key={idea.id} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{idea.title}</p>
                      <p
                        className={cn(
                          "mt-0.5 text-xs",
                          IMPACT_STYLE[impact.level],
                        )}
                      >
                        {impact.level} impact · {impact.goal}
                      </p>
                    </div>
                    <Link
                      href={`/write?idea=${encodeURIComponent(idea.id)}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Write
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <SectionHeader
            title="Recent posts"
            href="/posts"
            linkLabel="All posts"
          />
          {posts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No posts in the content folder yet.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {posts.slice(0, 4).map((post) => {
                const issues = needCleanup.find(
                  (p) => p.post.slug === post.slug,
                )?.issues;
                return (
                  <li key={post.slug} className="p-3">
                    <p className="truncate text-sm font-medium">{post.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {post.date ? formatDate(post.date) : "No date"} ·{" "}
                      {post.wordCount.toLocaleString()} words
                      {issues && (
                        <span className="text-warning"> · needs cleanup</span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div>
        <SectionHeader
          title={
            search.startDate && search.endDate
              ? `Google search, ${formatDate(search.startDate)} to ${formatDate(search.endDate)}`
              : "Google search"
          }
        />
        {!search.configured ? (
          <p className="text-sm text-muted-foreground">
            Add{" "}
            <code className="font-mono text-foreground">GSC_CLIENT_EMAIL</code>{" "}
            and{" "}
            <code className="font-mono text-foreground">GSC_PRIVATE_KEY</code>{" "}
            to <code className="font-mono text-foreground">.env</code> to see
            clicks, impressions and rankings for your posts.
          </p>
        ) : search.error ? (
          <p className="text-sm text-destructive">
            Search Console: {search.error}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Clicks" value={compact(clicks)} />
              <StatTile label="Impressions" value={compact(impressions)} />
              <StatTile
                label="Average rank"
                value={impressions ? position.toFixed(1) : "–"}
              />
            </div>
            {topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No posts have shown up in Google yet.
              </p>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Top posts by clicks</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="p-3 font-normal">
                        Top posts
                      </th>
                      <th scope="col" className="p-3 text-right font-normal">
                        Clicks
                      </th>
                      <th scope="col" className="p-3 text-right font-normal">
                        Impressions
                      </th>
                      <th scope="col" className="p-3 text-right font-normal">
                        Rank
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topPosts.map(([slug, p]) => (
                      <tr key={slug}>
                        <td className="max-w-0 truncate p-3">
                          {titles.get(slug)}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {p.clicks.toLocaleString()}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {p.impressions.toLocaleString()}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {p.position.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
