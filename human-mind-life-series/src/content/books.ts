/**
 * ============================================================================
 *  BOOK CONTENT — edit descriptions, chapters and previews here.
 * ============================================================================
 *
 *  Prices and cover images are set in src/config/site.config.ts.
 *
 *  IMPORTANT: The "learn" and "topics" lists below were written from each
 *  book's title only. Please check them against your manuscript and edit them
 *  so they describe exactly what each book contains.
 *
 *  • toc       — chapter titles. Leave [] to hide the "Contents" section.
 *  • sample    — a short preview excerpt from the book. Leave null to show a
 *                "request a free sample on WhatsApp/email" box instead.
 *  • slug      — the web address: /books/<slug>. Changing it changes the URL
 *                (update any running ads if you do).
 * ============================================================================
 */

export type FaqItem = { q: string; a: string };

export type BookContent = {
  volume: 1 | 2 | 3 | 4 | 5 | 6;
  slug: string;
  title: string;
  tagline: string;
  shortDescription: string;
  description: string[];
  learn: string[];
  topics: string[];
  toc: string[];
  sample: { heading: string; paragraphs: string[] } | null;
  faqs: FaqItem[];
  disclaimer?: string;
  /** Language the book is written in (Google language code). Default "en". */
  sourceLanguage?: string;
  /** Hide "Volume N" wherever this book's title is shown (used for The Intimacy Code). */
  hideVolumeLabel?: boolean;
  /** Marks the book as intended for adult readers (18+). */
  adultsOnly?: boolean;
  /** Colours for the built-in typographic cover. */
  coverTheme: { bg: string; accent: string };
  seo: { title: string; description: string };
};

const GENERAL_DISCLAIMER =
  "This book is intended for general educational and self-development purposes. It is not a substitute for professional psychological, psychiatric or medical advice, diagnosis or treatment. If you are struggling with your mental health, please consult a qualified professional.";

export const BOOKS: BookContent[] = [
  {
    volume: 1,
    slug: "the-psychology-of-human-behavior",
    title: "The Psychology of Human Behavior",
    tagline: "Understand the forces that shape how people think, feel and act.",
    shortDescription:
      "An accessible guide to the psychology behind everyday human behaviour — and what it reveals about ourselves and the people around us.",
    description: [
      "Why do we react the way we do? Why do the same situations bring out such different responses in different people? The Psychology of Human Behavior opens the series by exploring the patterns that sit beneath ordinary human actions.",
      "Written for curious readers rather than specialists, this volume aims to make the study of human behaviour practical and approachable, so that you can recognise these patterns in your own life, relationships and work.",
    ],
    learn: [
      "How thoughts, emotions and actions influence one another",
      "Why people can respond so differently to the same situation",
      "How habits and surroundings shape everyday behaviour",
      "Ways to observe your own behavioural patterns with more clarity",
    ],
    topics: ["Human behaviour", "Thoughts & emotions", "Habits", "Self-awareness", "Everyday psychology"],
    toc: [],
    sample: null,
    faqs: [
      {
        q: "Do I need a background in psychology to read this book?",
        a: "No. The book is written for general readers who are curious about human behaviour.",
      },
    ],
    disclaimer: GENERAL_DISCLAIMER,
    coverTheme: { bg: "#13233f", accent: "#c9a24f" },
    seo: {
      title: "The Psychology of Human Behavior — Volume 1",
      description:
        "Volume 1 of The Human Mind & Life Series: an accessible psychology book about understanding human behaviour, emotions and everyday choices.",
    },
  },
  {
    volume: 2,
    slug: "why-people-do-what-they-do",
    title: "Why People Do What They Do",
    tagline: "Explore the motives and needs behind human choices.",
    shortDescription:
      "A thoughtful look at the motives, needs and influences that drive the decisions people make every day.",
    description: [
      "Every action has a reason, even when that reason is hidden from the person taking it. Why People Do What They Do looks at the motivations behind human choices and the influences that quietly guide them.",
      "This volume invites you to look past surface behaviour and ask a deeper question about yourself and others: what is really driving this?",
    ],
    learn: [
      "The common needs and motives that drive human decisions",
      "How outside influences can shape the choices people make",
      "Why people sometimes act against their own stated goals",
      "How understanding motives can improve empathy and communication",
    ],
    topics: ["Motivation", "Decision-making", "Human needs", "Social influence", "Empathy"],
    toc: [],
    sample: null,
    faqs: [
      {
        q: "Who is this book for?",
        a: "Anyone who wants to better understand the reasons behind their own behaviour and the behaviour of the people around them.",
      },
    ],
    disclaimer: GENERAL_DISCLAIMER,
    coverTheme: { bg: "#3a1f2b", accent: "#d8a86b" },
    seo: {
      title: "Why People Do What They Do — Volume 2",
      description:
        "Volume 2 of The Human Mind & Life Series: a book about human nature, motivation and the hidden reasons behind the choices people make.",
    },
  },
  {
    volume: 3,
    slug: "ancient-wisdom-for-the-modern-mind",
    title: "Ancient Wisdom for the Modern Mind",
    tagline: "Timeless insight for the pressures of modern life.",
    shortDescription:
      "Time-tested ideas about the mind and a meaningful life, brought into conversation with the challenges of today.",
    description: [
      "Long before modern psychology, thinkers and traditions around the world reflected deeply on the mind, suffering, purpose and how to live well. Ancient Wisdom for the Modern Mind revisits such ideas and asks what they can offer readers today.",
      "This volume is for anyone looking for calm, perspective and meaning amid a fast, distracted and demanding world.",
    ],
    learn: [
      "Enduring ideas about the mind and how to live well",
      "How timeless wisdom can be applied to modern stress and distraction",
      "Perspectives that can support calm, clarity and purpose",
      "Ways to bring reflective practices into everyday life",
    ],
    topics: ["Timeless wisdom", "Inner calm", "Meaning & purpose", "Clarity of mind", "Personal growth"],
    toc: [],
    sample: null,
    // Add book-specific questions here once you have confirmed the answers, e.g.
    // { q: "Is this a religious book?", a: "…your answer…" },
    faqs: [],
    disclaimer: GENERAL_DISCLAIMER,
    coverTheme: { bg: "#1f3a33", accent: "#d4b46a" },
    seo: {
      title: "Ancient Wisdom for the Modern Mind — Volume 3",
      description:
        "Volume 3 of The Human Mind & Life Series: timeless wisdom applied to modern life, for readers seeking calm, clarity and personal growth.",
    },
  },
  {
    // All content below is taken from the Volume 4 PDF itself ("Intimacy After 50"):
    // title page, preface, introduction, table of contents, Chapter 1 learning
    // objectives and the book's own disclaimer. PDF: storage/books/volume-4.pdf
    volume: 4,
    slug: "volume-4",
    title: "Intimacy After 50",
    tagline: "Understanding Connection, Sexuality, and Healthy Relationships in Midlife and Beyond.",
    shortDescription:
      "A practical, respectful guide to connection, sexuality and healthy relationships in midlife and beyond, where intimacy can evolve with the body, health, relationship and values.",
    description: [
      "Intimacy does not have an expiration date. Intimacy After 50 treats intimacy as part of adult life that can evolve with the body, health, relationship and values. It discusses physical changes without turning them into defects, and sexuality without making performance the measure of worth.",
      "Across 13 chapters, the book covers body image and confidence, menopause, men’s sexual health, desire and libido, communication and consent, emotional intimacy, dating and new relationships after 50, health and medication, pleasure, intimacy during illness and caregiving, and rebuilding closeness, ending with a personal intimacy plan for life after 50.",
      "It does not tell every reader to become sexually active. Some people want sexual relationships, some want companionship, some prioritise affection and some prefer to live alone. A healthy intimate life begins with autonomy and choice.",
    ],
    learn: [
      "How intimacy can evolve after 50",
      "How physical health, emotions, relationships and sexual experience interact",
      "Clearer communication about comfort, consent, preferences and boundaries",
      "When a change deserves professional medical attention",
      "Practical reflection exercises, without treating them as medical treatment",
      "How to build a personal intimacy plan for life after 50",
    ],
    topics: [
      "Midlife & later life",
      "Body image & confidence",
      "Menopause & men’s sexual health",
      "Communication & consent",
      "Dating & companionship",
      "Health & caregiving",
    ],
    toc: [
      "Reimagining Intimacy After 50",
      "Aging, Body Image, and Confidence",
      "Menopause, Vaginal Changes, and Comfort",
      "Erectile Changes, Men’s Sexual Health, and Medical Conversations",
      "Desire and Libido Across Midlife and Later Life",
      "Communication, Consent, and Boundaries",
      "Emotional Intimacy and Long-Term Partnership",
      "Dating, Companionship, and New Relationships After 50",
      "Health, Medication, and Talking With Healthcare Professionals",
      "Pleasure, Sexual Expression, and Redefining Performance",
      "Intimacy During Illness, Disability, and Caregiving",
      "Rebuilding Closeness in Long-Term Relationships",
      "A Personal Intimacy Plan for Life After 50",
    ],
    sample: {
      heading: "From the Preface",
      paragraphs: [
        "Intimacy does not have an expiration date.",
        "Yet people over 50 receive conflicting messages. One message says sexuality belongs to youth. Another says aging is a problem that must be reversed. Neither is especially useful.",
        "This volume takes a different approach. It treats intimacy as part of adult life that can evolve with the body, health, relationship, and values. It discusses physical changes without turning them into defects, and it discusses sexuality without making performance the measure of worth.",
        "Because this is a practical nonfiction book, some medical information is necessarily simplified. The referenced sources are included so that readers can continue their learning. The book also emphasizes communication, consent, privacy, and professional care because sexual health is never only about technique.",
      ],
    },
    faqs: [
      {
        q: "Is this book only about sex?",
        a: "No. The book treats intimacy as broader than sexual activity: affection, trust, emotional disclosure, companionship, tenderness, shared routines, humour, physical touch and sexual expression.",
      },
    ],
    disclaimer:
      "This book is an educational guide to intimacy, relationships, aging, and sexual health. It is not a diagnosis, prescription, or substitute for individualized medical, psychological, legal, or relationship advice. Persistent pain, bleeding, erectile difficulties, significant changes in sexual function, medication concerns, or symptoms that worry you should be discussed with an appropriately qualified healthcare professional.",
    coverTheme: { bg: "#2b2a44", accent: "#c7a35a" },
    seo: {
      title: "Intimacy After 50 — Volume 4",
      description:
        "Volume 4 of The Human Mind & Life Series: an educational guide to connection, sexuality and healthy relationships in midlife and beyond.",
    },
  },
  {
    volume: 5,
    slug: "a-healthy-sex-life-at-any-age",
    title: "A Healthy Sex Life at Any Age",
    tagline: "Intimacy, connection and wellbeing through every stage of life.",
    shortDescription:
      "A respectful, informative guide for adults on intimacy, communication and sexual wellbeing at every stage of life.",
    description: [
      "Sexual wellbeing is an important part of a healthy life, yet it is often surrounded by silence, myths and embarrassment. A Healthy Sex Life at Any Age approaches the subject in a mature, respectful and informative way.",
      "This volume is written for adults who want to understand intimacy better, communicate more openly with their partner, and approach changes across different stages of life with knowledge and confidence.",
    ],
    learn: [
      "Why open communication matters for a healthy intimate relationship",
      "How intimacy and needs may change across different stages of life",
      "How emotional connection relates to physical wellbeing",
      "When it may be helpful to seek professional medical advice",
    ],
    topics: ["Intimacy", "Communication", "Relationships", "Life stages", "Wellbeing"],
    toc: [],
    sample: null,
    faqs: [
      {
        q: "Is this book suitable for all ages?",
        a: "No. This book is intended for adult readers aged 18 and above.",
      },
    ],
    disclaimer:
      "This book is intended for adults (18+) and is provided for general educational purposes only. It does not provide medical advice and is not a substitute for consultation with a qualified doctor or healthcare professional. Please consult a doctor about any medical or sexual health concern.",
    adultsOnly: true,
    coverTheme: { bg: "#4a1d24", accent: "#e0b07a" },
    seo: {
      title: "A Healthy Sex Life at Any Age — Volume 5",
      description:
        "Volume 5 of The Human Mind & Life Series: a respectful, educational guide for adults on intimacy, communication and sexual wellbeing.",
    },
  },
  {
    // All content below is taken from the book itself ("The Intimacy Code",
    // 20-chapter edition): title page, index, introduction and publishing note.
    volume: 6,
    hideVolumeLabel: true,
    slug: "volume-6",
    title: "The Intimacy Code",
    tagline: "The Modern Global Guide to Attraction, Intimacy, Pleasure & Connection.",
    shortDescription:
      "An 18+ adult educational guide that brings historical traditions and modern evidence together in one readable framework for attraction, intimacy, communication and sexual health.",
    description: [
      "The Intimacy Code is written for adults who want a broader understanding of attraction, intimacy, sexual communication, pleasure and sexual health. It brings historical traditions and modern evidence into one readable framework, without pretending that they are the same kind of knowledge.",
      "Across 20 chapters, the book moves from the chemistry of desire and the emotional foundations of intimacy, through Indian, Islamic, Christian, Jewish, Taoist and other cultural perspectives, to the science of arousal, communication, mismatched desire, body image, long-term passion and sexual health, and closes with practical seven-day and thirty-day exercises.",
      "It is intentionally practical, but it is not a list of tricks. Consent, safety and mutual respect remain foundational throughout. Religious traditions are presented respectfully and in context, and the book does not issue religious rulings.",
    ],
    learn: [
      "How attraction, anticipation, novelty and emotional safety allow desire to grow",
      "How attention, communication, trust and confidence create intimacy before physical contact",
      "How to ask, listen and give feedback about preferences without turning intimacy into a performance review",
      "How to approach mismatched desire, rejection and pressure, and rebuild closeness",
      "Sexual health essentials: safer sex, contraception, testing, pain and when professional care matters",
      "A final framework built on attraction, safety, consent, communication, pleasure, health and curiosity",
    ],
    topics: [
      "Attraction & desire",
      "Emotional intimacy",
      "Communication & consent",
      "Cultural & historical perspectives",
      "Sexual health",
      "Long-term relationships",
    ],
    toc: [
      "The Chemistry of Desire",
      "Before the Bedroom",
      "The Ancient Indian Lens",
      "Islam, Marriage & Intimacy",
      "Christian & Biblical Perspectives",
      "Jewish, Taoist & Other Traditions",
      "The Science of Arousal",
      "The Art of Foreplay",
      "Intercourse With Connection",
      "Positions, Comfort & Variety",
      "The Pleasure Conversation",
      "When Desire Doesn’t Match",
      "Confidence, Body Image & Performance",
      "Emotional Intimacy",
      "Long-Term Passion",
      "Sexual Health & Safer Sex",
      "Fantasies, Privacy & Digital Intimacy",
      "Different People, Different Relationships",
      "The Intimacy Reset",
      "The Intimacy Code",
    ],
    sample: {
      heading: "From the Introduction",
      paragraphs: [
        "This book is written for adults who want a broader understanding of attraction, intimacy, sexual communication, pleasure and sexual health. It brings historical traditions and modern evidence into one readable framework without pretending that they are the same kind of knowledge.",
        "Ancient and religious sources tell us what particular societies believed, valued or practiced. Modern research is better suited to questions about physiology, psychology, contraception, infection prevention and clinical care.",
        "Religious traditions are presented respectfully and in context. This book does not issue religious rulings. Modern health questions should be answered with current medical evidence.",
        "The book is intentionally practical: attraction, foreplay, intercourse, positions, communication, desire differences, emotional intimacy, long-term passion, sexual health, privacy and cultural perspectives. Consent, safety and mutual respect remain foundational.",
        "The result is not a list of tricks. It is a framework for understanding why intimacy works when it works—and why it sometimes fails even when two people care deeply about one another.",
      ],
    },
    faqs: [
      {
        q: "Is The Intimacy Code really free?",
        a: "Yes. The Intimacy Code is completely free. There is no payment, no QR code and no transaction ID. Just enter your name and email address to get your copy.",
      },
      {
        q: "Who is this book for?",
        a: "Adults aged 18 and above. It is an adult educational edition about attraction, intimacy, communication and sexual health.",
      },
      {
        q: "Does the book give medical or religious advice?",
        a: "No. Religious traditions are presented in context and the book does not issue religious rulings. For any medical or sexual-health concern, please consult a qualified doctor.",
      },
    ],
    disclaimer:
      "This book is intended for adults (18+) and is provided for general educational purposes only. It is not medical, psychological or religious advice and is not a substitute for consultation with a qualified doctor or healthcare professional. S. K. Aria is a pen name; no academic or medical credentials are claimed.",
    adultsOnly: true,
    coverTheme: { bg: "#1c1016", accent: "#e2b86a" },
    seo: {
      title: "The Intimacy Code — Free Book",
      description:
        "Get The Intimacy Code free, part of The Human Mind & Life Series: an 18+ educational guide to attraction, communication, emotional intimacy and sexual health.",
    },
  },
];

/** Shown on the Home page and in the "Why read this series?" section. */
export const SERIES = {
  shortDescription:
    "A six-volume series exploring the human mind, behaviour, relationships and the art of living well — written in clear, accessible language for curious readers.",
  longDescription: [
    "The Human Mind & Life Series brings together six books that explore how we think, why we act, what timeless wisdom can teach us, and how to care for the most personal parts of our lives.",
    "Each volume focuses on its own theme, and together they offer a broad, thoughtful journey into understanding human nature — and understanding yourself.",
  ],
  /** Shown on the About page. Edit freely to describe the mission in your own words. */
  mission:
    "To make ideas about the human mind and a well-lived life clear, accessible and useful — so that readers can understand themselves and the people around them a little better, and carry that understanding into everyday life.",
  /** "Why the series was created" — shown on the About page. */
  whyCreated: [
    "Many of the most useful ideas about human behaviour, motivation, wisdom and wellbeing are scattered across academic texts, old traditions and specialist books that can feel difficult to approach.",
    "The Human Mind & Life Series was created to bring these themes together in one place: six focused volumes, each written in plain language, that a curious reader can pick up in any order and return to over time.",
  ],
  whyRead: [
    {
      title: "Understand yourself",
      text: "Recognise the patterns behind your own thoughts, emotions and decisions.",
    },
    {
      title: "Understand others",
      text: "Gain insight into the motives and behaviour of the people around you.",
    },
    {
      title: "Live with more clarity",
      text: "Combine psychological understanding with timeless wisdom for everyday life.",
    },
    {
      title: "Accessible and practical",
      text: "Written in plain language for curious readers — no specialist background needed.",
    },
  ],
  benefits: [
    "Six focused volumes, each on a distinct theme",
    "The Intimacy Code is completely free",
    "Clear, jargon-free writing",
    "Read on your phone, tablet or computer",
    "Delivered personally to your email or WhatsApp",
    "Simple, secure UPI payment",
    "Direct support by email or WhatsApp",
  ],
};
