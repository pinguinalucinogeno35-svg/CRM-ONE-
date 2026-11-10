import { Suspense } from "react";
import { Sidebar, SidebarSkeleton } from "@/components/sidebar";
import { PageSkeleton } from "@/components/ui";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
