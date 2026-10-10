import { PageHeader } from "./PageHeader";

/** Update this date whenever you change a policy page. */
export const POLICIES_LAST_UPDATED = "7 October 2026";

export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <>
      <PageHeader eyebrow="Policies" title={title} intro={intro} />
      <article className="container-page max-w-3xl py-14 sm:py-16">
        <p className="text-sm text-muted">Last updated: {POLICIES_LAST_UPDATED}</p>
        <div className="prose-legal mt-4">{children}</div>
      </article>
    </>
  );
}
