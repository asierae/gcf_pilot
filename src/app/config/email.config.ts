/**
 * Public contact inbox. Used on the landing page, footers and as reply-to for
 * every automatic email.
 */
export const CONTACT_EMAIL = 'contact@averacapitalaccess.com';

/**
 * Sender of automatic notifications (submission receipts, review emails).
 * This inbox does not need feedback, so replies are routed to CONTACT_EMAIL.
 */
export const NOREPLY_EMAIL = 'noreply@averacapitalaccess.com';

/** Backend API base URL — empty uses same origin + proxy in dev */
export const EMAIL_API_URL = '';
