import { CONFIG } from "@/config/site.config";

/**
 * The site-wide professional disclaimer, shown on the general (non-medical) book
 * pages and as a dedicated section on the FAQ page. Book-specific disclaimers
 * (e.g. the 18+/medical volumes) are defined per book in src/content/books.ts and
 * are intentionally NOT replaced by this text.
 *
 * The brand name comes from CONFIG.SITE_NAME so it always matches the rest of the
 * site; change the brand there, not here.
 */
export const GENERAL_DISCLAIMER_PARAGRAPHS: readonly string[] = [
  `${CONFIG.SITE_NAME} is intended for educational and informational purposes only. Our eBooks explore topics such as human psychology, emotions, relationships, communication, personal development, and everyday life experiences.`,
  "The content is not intended to replace professional medical, psychological, mental health, legal, or other qualified professional advice. Readers should consult an appropriate professional for guidance relating to their individual circumstances.",
  "While we make reasonable efforts to provide useful and accurate information, we do not guarantee that every statement is complete, current, or applicable to every reader. Individual experiences and outcomes may vary.",
  "All eBook purchases, payments, downloads, and account access are subject to the applicable terms and conditions and the policies displayed on our website. Customers should review the relevant product details before purchasing.",
  "By accessing or purchasing our content, you acknowledge that you are responsible for how you interpret and use the information provided.",
];

/** The same disclaimer as one string (paragraphs separated by a blank line). */
export const GENERAL_DISCLAIMER = GENERAL_DISCLAIMER_PARAGRAPHS.join("\n\n");
