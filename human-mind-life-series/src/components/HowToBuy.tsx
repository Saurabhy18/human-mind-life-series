import { paymentCopy } from "@/content/paymentCopy";
import { checkoutMode } from "@/lib/server/paymentService";

export function HowToBuy() {
  const steps = paymentCopy(checkoutMode()).howToBuy;
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="card p-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-white">{i + 1}</span>
          <h3 className="mt-4 text-lg">{s.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
