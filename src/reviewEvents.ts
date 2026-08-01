const REVIEWS_CHANGED_EVENT = "reviews:changed";

export function notifyReviewsChanged() {
  window.dispatchEvent(new Event(REVIEWS_CHANGED_EVENT));
}

export { REVIEWS_CHANGED_EVENT };
