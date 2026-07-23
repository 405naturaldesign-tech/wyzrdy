import React from 'react';
import { Helmet } from 'react-helmet';

const SITE = 'Wyzrdy';
const BASE_URL = 'https://wyzrdy.com';
const DEFAULT_IMAGE = 'https://images.hostinger.com/9ddaca5d-4b63-480b-bdb2-f57759180205.png';

/**
 * Reusable SEO head component. Emits title/description, canonical, robots,
 * Open Graph, Twitter Card, viewport/charset, favicon, hreflang and any
 * JSON-LD structured data passed via `jsonLd` (object or array of objects).
 */
export default function Seo({
  title,
  description,
  path = '/',
  image = DEFAULT_IMAGE,
  type = 'website',
  keywords,
  noindex = false,
  jsonLd,
}) {
  const fullTitle = title?.includes(SITE) ? title : `${title} | ${SITE}`;
  const url = `${BASE_URL}${path}`;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <html lang="en" />
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'} />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="en" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <meta name="theme-color" content="#0a0a12" />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {blocks.map((block, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(block)}</script>
      ))}
    </Helmet>
  );
}

export const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Wyzrdy',
  url: BASE_URL,
  logo: `${BASE_URL}/favicon.svg`,
  description: 'Wyzrdy is a unified AI business operating system that plans, builds, optimizes and grows real revenue systems.',
  sameAs: [],
};

export function softwareAppSchema({ name, description, category = 'BusinessApplication', url }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    applicationCategory: category,
    operatingSystem: 'Web',
    description,
    url: `${BASE_URL}${url}`,
    offers: { '@type': 'Offer', price: '11.69', priceCurrency: 'USD' },
  };
}

export function faqSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: { '@type': 'Answer', text: q.a },
    })),
  };
}

export function breadcrumbSchema(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${BASE_URL}${c.path}`,
    })),
  };
}
