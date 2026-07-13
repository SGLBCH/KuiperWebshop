import type { MetadataRoute } from 'next'

// Besloten B2B-omgeving: alleen de publieke entreepagina's mogen
// geïndexeerd worden.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/login', '/signup'],
        disallow: ['/dashboard', '/configurator', '/admin', '/profile', '/api/', '/pending', '/reset', '/forgot', '/offerte/'],
      },
    ],
  }
}
