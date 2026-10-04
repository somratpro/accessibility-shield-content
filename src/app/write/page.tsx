import { WriteStudio } from "@/components/write-studio";
import { Suspense } from "react";

export default function WritePage() {
  return (
    <Suspense>
      <WriteStudio />
    </Suspense>
  );
}
