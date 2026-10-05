import { Card } from "./ui/card";
import { PageSkeleton, Skeleton } from "./ui/skeleton";

// Each skeleton mirrors the real page's structure and spacing so nothing shifts when content arrives.

const List = ({ children }: { children: React.ReactNode }) => (
  <ul className="divide-y divide-border rounded-lg border border-border bg-background">{children}</ul>
);

function StatTileSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-24" />
    </Card>
  );
}

function SectionHeaderSkeleton({ link = true }: { link?: boolean }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-4">
      <Skeleton className="h-4 w-24" />
      {link && <Skeleton className="h-3 w-14" />}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <PageSkeleton className="space-y-8">
      <div>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-1.5 h-4 w-44" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <SectionHeaderSkeleton />
          <List>
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-16" />
              </li>
            ))}
          </List>
        </div>
        <div>
          <SectionHeaderSkeleton />
          <List>
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="space-y-1.5 p-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </li>
            ))}
          </List>
        </div>
      </div>

      <div>
        <SectionHeaderSkeleton link={false} />
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-7 w-14" />
              </Card>
            ))}
          </div>
          <Card>
            <div className="border-b border-border p-3">
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-6 p-3">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageSkeleton>
  );
}

/** Just the list, for the in-page loading state once the heading is already on screen. */
export function IdeasListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul
      role="status"
      aria-busy="true"
      aria-label="Loading ideas"
      className="divide-y divide-border rounded-lg border border-border bg-background"
    >
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-8" />
        </li>
      ))}
    </ul>
  );
}

export function IdeasSkeleton() {
  return (
    <PageSkeleton className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="mt-1.5 h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <IdeasListSkeleton />
    </PageSkeleton>
  );
}

export function PostsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul
      role="status"
      aria-busy="true"
      aria-label="Loading posts"
      className="divide-y divide-border rounded-lg border border-border bg-background"
    >
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-8 w-36 sm:block" />
          <Skeleton className="h-8 w-20" />
        </li>
      ))}
    </ul>
  );
}

export function PostsSkeleton() {
  return (
    <PageSkeleton className="space-y-4">
      <div>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-1.5 h-4 w-72 max-w-full" />
      </div>
      <PostsListSkeleton />
    </PageSkeleton>
  );
}

export function WriteSkeleton() {
  return (
    <PageSkeleton className="space-y-6">
      <Skeleton className="h-7 w-16" />
      <Card className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-[5.5rem] w-full" />
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-24" />
        </div>
      </Card>
    </PageSkeleton>
  );
}
