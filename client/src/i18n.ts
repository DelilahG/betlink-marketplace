/**
 * Interface strings. English ships first; add an `am` (Amharic) dictionary with the same keys and
 * switch `locale` to translate the UI without touching components.
 */
const en = {
  'nav.rent': 'Rent',
  'nav.buy': 'Buy',
  'nav.list': 'List a property',
  'nav.dashboard': 'Dashboard',
  'nav.account': 'Account',
  'nav.admin': 'Admin',
  'nav.login': 'Log in',
  'nav.register': 'Sign up',
  'nav.logout': 'Log out',
  'hero.eyebrow': 'Homes & property across Ethiopia',
  'hero.title': 'Find the place you will call home',
  'hero.body': 'Apartments in Bole, family compounds in CMC, condominiums in Ayat and homes from Bahir Dar to Hawassa — listed by owners and agents, with prices in birr.',
  'search.placeholder': 'Subcity, neighbourhood or city — e.g. Bole, Sarbet, Hawassa',
  'search.submit': 'Search',
  'listing.perMonth': '/ month',
  'listing.perYear': '/ year',
  'listing.demo': 'Demo listing',
  'listing.verified': 'Verified listing',
  'listing.unverified': 'Not verified',
  'empty.results': 'No properties match these filters',
  'empty.resultsHint': 'Try a wider price range, fewer filters, or a nearby neighbourhood.',
  'error.generic': 'Something went wrong. Please try again.',
} as const;

export type MessageKey = keyof typeof en;
const dictionaries: Record<string, Partial<Record<MessageKey, string>>> = { en };
const locale = 'en';

export function t(key: MessageKey): string {
  return dictionaries[locale]?.[key] ?? en[key];
}
