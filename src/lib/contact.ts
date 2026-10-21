/** The project's public inbox, for every mailto on the site. */
export const CONTACT_EMAIL = "contact@neervazhvu.org";

export function contactMailto(subject: string, body?: string): string {
  const q = `subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
  return `mailto:${CONTACT_EMAIL}?${q}`;
}

/** The same message as a Gmail compose page: the way through when a mailto
 *  link opens nothing (no mail app, or a browser with no mail handler). */
export function contactGmail(subject: string, body: string): string {
  const q = new URLSearchParams({ view: "cm", to: CONTACT_EMAIL, su: subject, body });
  return `https://mail.google.com/mail/?${q}`;
}
