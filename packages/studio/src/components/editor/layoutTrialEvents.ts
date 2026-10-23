/** Offer a non-persistent alternative without starting it during a failed gesture. */
export const LAYOUT_TRIAL_OFFER_EVENT = "hf-layout-trial-offer";

export function offerLayoutTrial(document: Document | undefined): void {
  if (typeof window === "undefined" || !document) return;
  window.dispatchEvent(new CustomEvent(LAYOUT_TRIAL_OFFER_EVENT, { detail: document }));
}

export const LAYOUT_TRIAL_REQUEST_EVENT = "hf-layout-trial-request";

/** Open only the launcher belonging to this preview document. */
export function requestLayoutTrial(document: Document): void {
  window.dispatchEvent(new CustomEvent(LAYOUT_TRIAL_REQUEST_EVENT, { detail: document }));
}
