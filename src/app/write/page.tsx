import { WriteStudio } from "@/components/write-studio";
import { WriteSkeleton } from "@/components/page-skeletons";
import { Suspense } from "react";

export default function WritePage() {
  return (
    <Suspense fallback={<WriteSkeleton />}>
      <WriteStudio />
    </Suspense>
  );
}
