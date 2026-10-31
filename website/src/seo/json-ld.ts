/**
 * 官网 JSON-LD 构建（GEO / 常规 SEO）。
 * 事实须与可见文案、docs/pricing.md、Install CTA 一致；禁止 InStock 冒充可装。
 */

export const CANONICAL_ORIGIN = 'https://yiveno.com'

export const ORG_ID = `${CANONICAL_ORIGIN}/#organization`
export const WEBSITE_ID = `${CANONICAL_ORIGIN}/#website`
export const SOFTWARE_ID = `${CANONICAL_ORIGIN}/#software`

/** 产品一句话（与首页 / 产品文档 §0.1 对外心智对齐） */
export const PRODUCT_DESCRIPTION =
  'Find what you saved from what you remember. Closest fits — you pick. Chromium extension for Microsoft Edge and Google Chrome. Not yet listed on public stores.'

export type FaqEntry = {
  question: string
  answer: string
}

/** Organization + WebSite + SoftwareApplication（首页 @graph） */
export function buildHomeJsonLdGraph(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'Yiveno',
        url: CANONICAL_ORIGIN,
        logo: `${CANONICAL_ORIGIN}/images/logo-mark.png`,
        sameAs: ['https://github.com/yiveno'],
        email: 'support@yiveno.com'
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: 'Yiveno',
        url: CANONICAL_ORIGIN,
        description: PRODUCT_DESCRIPTION,
        publisher: { '@id': ORG_ID },
        inLanguage: ['en', 'zh-CN']
      },
      {
        '@type': 'SoftwareApplication',
        '@id': SOFTWARE_ID,
        name: 'Yiveno',
        applicationCategory: 'BrowserApplication',
        operatingSystem: 'Google Chrome, Microsoft Edge',
        url: CANONICAL_ORIGIN,
        description: PRODUCT_DESCRIPTION,
        author: { '@id': ORG_ID },
        offers: [
          {
            '@type': 'Offer',
            name: 'Free',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/PreOrder',
            description:
              'Same on-device find quality as Pro. Store listing not public yet; Free is $0 when available to install.'
          },
          {
            '@type': 'Offer',
            name: 'Pro',
            price: '7.99',
            priceCurrency: 'USD',
            availability: 'https://schema.org/PreOrder',
            description:
              'Display anchor $7.99/month or $59.99/year (USD). Adds excerpt cloud sync across devices and higher cloud clue help. Not a claim of a live public paid base; Chromium stores not listed yet.'
          }
        ]
      }
    ]
  }
}

/** FAQPage（须与页面可见 Q&A 一一对应） */
export function buildFaqPageJsonLd(entries: FaqEntry[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map(entry => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer
      }
    }))
  }
}

/** 官网 FAQ 可见条目（单一权威；页面与 JSON-LD 共用） */
export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: 'What is Yiveno?',
    answer:
      'Yiveno is the thing that finds what you saved. Capture pages or passages with low friction, then Recall by saying what you remember. It returns a short list of closest fits — you pick. It is a Chromium browser extension for Microsoft Edge and Google Chrome.'
  },
  {
    question: "What isn't Yiveno?",
    answer:
      'Yiveno is not a bookmark manager, notes app, chatbot, or AI organizer as its primary promise. It does not claim one guaranteed correct link; closest fits are suggestions, not an oracle.'
  },
  {
    question: 'How does Recall work?',
    answer:
      'You type a clue in everyday language — you do not need the exact title. Yiveno ranks a neighborhood of saved things that best match what you remember. Top pick is a suggestion; you decide which item is right.'
  },
  {
    question: 'Where is my data stored?',
    answer:
      'By default, what you Capture stays on your device (local IndexedDB). Signing in does not by itself upload your library. Cloud sync of text excerpts is optional and account-scoped. We do not sell your collection or use your saved content to train public models.'
  },
  {
    question: 'What is Free vs Pro?',
    answer:
      'Find quality on your device is the same on Free and Pro. Free is $0. Pro display anchors are $7.99/month or $59.99/year (USD) and add excerpt sync across devices plus higher limits for cloud help with your clues. Checkout uses USD anchors; local currency on the receipt may reflect exchange rates.'
  },
  {
    question: 'Can I install Yiveno today?',
    answer:
      'Not from the public Chrome Web Store or Microsoft Edge Add-ons yet. When listed, mainland desktop prefers Edge Add-ons. We will not ask you to sideload a ZIP as the main install path.'
  }
]
