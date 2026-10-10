import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { gatewayEnabled } from "@/lib/server/paymentService";
import { TranslationProgress } from "@/components/translation/TranslationProgress";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({ title: "Your Order", description: "Order status and download.", path: "/order/status", noIndex: true });

type Props = { params: Promise<{ ref: string }> };

/**
 * Customer order page. Holds NO customer data itself: the browser reads the
 * secret token from the URL fragment (#t=…, never sent to the server in the
 * page request) and calls the authorized status/download APIs.
 */
export default async function OrderStatusPage({ params }: Props) {
  const { ref } = await params;
  if (!/^HM-[A-Z0-9]{8}$/.test(ref)) notFound();
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-center text-4xl">Your order</h1>
        <TranslationProgress orderRef={ref} gateway={gatewayEnabled()} />
      </div>
    </div>
  );
}
