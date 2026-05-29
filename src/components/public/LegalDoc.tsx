// Shared chrome for the legal pages (/terms, /privacy). Renders the
// title, the "last updated" line, a draft-review notice, and a prose
// container that styles the section markup each page passes as children.

import { Eyebrow, Heading } from "@/components/brand";

export function LegalDoc({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <div className="space-y-2">
        <Eyebrow>Legal</Eyebrow>
        <Heading as="h1" size="display">
          {title}
        </Heading>
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Last updated · {lastUpdated}
        </p>
      </div>

      {/* Draft notice — these documents are a starting point and have not
          been reviewed by counsel. Remove once they have. */}
      <p className="mt-6 rounded-lg border border-border bg-bone-deep px-4 py-3 text-xs text-muted-foreground">
        This is a plain-language summary provided for transparency. It is
        not legal advice and is being finalized. If anything here is
        unclear, reach out before relying on it.
      </p>

      <div
        className="
          mt-10 space-y-8 text-sm leading-relaxed text-ink/80
          [&_h2]:pt-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:tracking-tight [&_h2]:text-ink
          [&_p]:mt-2
          [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5
          [&_a]:text-paprika [&_a]:underline [&_a]:underline-offset-2
          [&_strong]:text-ink
        "
      >
        {children}
      </div>
    </main>
  );
}
