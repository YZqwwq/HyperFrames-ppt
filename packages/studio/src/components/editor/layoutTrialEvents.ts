/** Offer a non-persistent alternative without starting it during a failed gesture. */
export const LAYOUT_TRIAL_OFFER_EVENT = "hf-layout-trial-offer";

export function offerLayoutTrial(document: Document | undefined): void {
  if (typeof window === "undefined" || !document) return;
  window.dispatchEvent(new CustomEvent(LAYOUT_TRIAL_OFFER_EVENT, { detail: document }));
}
