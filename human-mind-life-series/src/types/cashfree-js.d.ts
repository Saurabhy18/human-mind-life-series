/**
 * Minimal type declarations for @cashfreepayments/cashfree-js (the package ships no types).
 * Covers only what this project uses: load() and cashfree.checkout().
 * See https://www.cashfree.com/docs/payments/online/web/integration for the full SDK surface.
 */
declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeMode = "sandbox" | "production";

  export interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    /** "_modal" opens the hosted checkout in an overlay; "_self" redirects the whole page. */
    redirectTarget?: "_self" | "_blank" | "_top" | "_modal" | HTMLElement;
    returnUrl?: string;
  }

  export interface CashfreeCheckoutResult {
    error?: { message?: string; code?: string; type?: string } | null;
    redirect?: boolean;
    paymentDetails?: { paymentMessage?: string } | null;
  }

  export interface Cashfree {
    checkout(options: CashfreeCheckoutOptions): Promise<CashfreeCheckoutResult>;
  }

  export function load(options: { mode: CashfreeMode }): Promise<Cashfree>;
}
