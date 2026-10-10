export function PageHeader({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: React.ReactNode }) {
  return (
    <section className="border-b border-line bg-cream/60">
      <div className="container-page py-14 sm:py-20">
        {eyebrow && <p className="eyebrow animate-fade-up">{eyebrow}</p>}
        <h1 className="mt-3 max-w-3xl animate-fade-up text-4xl leading-[1.1] sm:text-5xl">{title}</h1>
        {intro && <div className="mt-5 max-w-2xl animate-fade-up text-lg leading-relaxed text-muted">{intro}</div>}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, intro, center }: { eyebrow?: string; title: string; intro?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 text-lg leading-relaxed text-muted">{intro}</p>}
    </div>
  );
}
