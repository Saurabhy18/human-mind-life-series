import { CONFIG } from "@/config/site.config";

export function HowToBuy() {
  const steps = [
    { title: "Click “Buy Now”", text: "Choose your book and go to the secure payment page." },
    { title: "Scan & pay by UPI", text: "Use Google Pay, PhonePe, Paytm, BHIM or any UPI app." },
    { title: "Submit your details", text: "Enter your UTR / Transaction ID and upload a payment screenshot." },
    { title: "Receive your book", text: `After verification, your ${CONFIG.BOOK_FORMAT} is sent to your email / WhatsApp.` },
  ];
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
