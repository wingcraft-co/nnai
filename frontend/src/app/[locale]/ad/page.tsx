import { AdModule } from "@/components/ad/AdModule";

export default function LocalizedAdPage() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide">Ad Prototype Workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">파트너 광고 모듈 프리뷰</p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div>
            <h2 className="mb-2 text-sm uppercase tracking-[0.12em] text-primary">Sidebar Variant</h2>
            <AdModule variant="sidebar" />
          </div>

          <div>
            <h2 className="mb-2 text-sm uppercase tracking-[0.12em] text-primary">Section Variant</h2>
            <AdModule variant="section" />
          </div>
        </section>
      </div>
    </main>
  );
}
