// Copy for the footer pages (Privacy, Terms, Rental Agreement, Contact,
// Locations) and the Support page. The amounts mirror src/lib/pricing.js and the
// SQL functions named there. Update both if a rule changes.
//
// Section body items: a string is a paragraph, { list: [...] } is a bullet list.

import {
  formatPeso, PROVIDER_MEMBERSHIP_FEE, PROVIDER_UPGRADE_FEE, RENTER_MEMBERSHIP_FEE, SERVICE_FEE,
} from '../lib/pricing';

export const SUPPORT_EMAIL = 'support@gearrent.ph';
export const LAST_UPDATED = 'October 5, 2026';

const renterFee = formatPeso(RENTER_MEMBERSHIP_FEE);
const providerFee = formatPeso(PROVIDER_MEMBERSHIP_FEE);
const upgradeFee = formatPeso(PROVIDER_UPGRADE_FEE);
const serviceFee = formatPeso(SERVICE_FEE);

export const legalPages = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Legal',
    intro: 'This policy explains what personal information Gear Rent collects, how we use it, and the choices you have. We handle personal data in line with the Data Privacy Act of 2012 (Republic Act No. 10173).',
    sections: [
      {
        id: 'who-we-are',
        heading: 'Who we are',
        body: [
          'Gear Rent is an equipment rental platform based in Cavite, Philippines. Creators rent cameras, lighting, audio, camping and event gear, and Gear Rent Providers list their own equipment for others to rent. Gear Rent is the personal information controller for the data described here.',
        ],
      },
      {
        id: 'information-we-collect',
        heading: 'Information we collect',
        body: [
          'We only collect what we need to run your account and your rentals:',
          {
            list: [
              'Account details: your name and email address. Passwords are handled by our authentication provider and are never visible to Gear Rent staff.',
              'Google sign-in: if you choose it, your Google name, email address and profile photo.',
              'Profile details you add: phone number, address, city, province and postal code.',
              'Rentals and payments: the items you rent, rental dates, amounts paid, security deposits, refunds, account balance movements and transfers. For membership payments we keep only the last four digits of the card used, never the full card number.',
              'Listings (Gear Rent Providers): equipment descriptions, prices and the photos you upload.',
              'Security information: sign-in sessions and the number of recent sign-in attempts, used to protect your account.',
            ],
          },
        ],
      },
      {
        id: 'how-we-use-it',
        heading: 'How we use your information',
        body: [
          {
            list: [
              'To create and secure your account and keep you signed in.',
              'To process rentals, memberships, deposits, refunds, provider earnings and transfers.',
              'To coordinate pickup and return of equipment.',
              'To send notifications about your bookings, due dates, returns and account.',
              'To review listings before they are published and to prevent misuse of the platform.',
              'To meet our legal, tax and accounting obligations.',
            ],
          },
          'We do not sell your personal information, and we do not use it for third-party advertising.',
        ],
      },
      {
        id: 'sharing',
        heading: 'When we share information',
        body: [
          {
            list: [
              'Between renters and providers: a provider sees the name of the person renting their gear, and renters see the name and email of the provider who listed an item.',
              'Service providers: our database, authentication and file storage are hosted by Supabase. If you use Google sign-in, Google processes that sign-in under its own privacy policy.',
              'Legal reasons: when required by law, court order or a lawful request from authorities, or to protect the rights and safety of our users.',
            ],
          },
        ],
      },
      {
        id: 'security',
        heading: 'How we protect your data',
        body: [
          'Information is sent over encrypted connections. Database access rules ensure each member can only see their own account, rentals and payments. Signing out ends your sessions on every device, and if you sign in without "Maintain Session" you are signed out automatically after 30 minutes of inactivity.',
        ],
      },
      {
        id: 'retention',
        heading: 'How long we keep it',
        body: [
          'We keep your account information for as long as your account is active. Rental, payment and balance records are kept even if you hide them from your history, because we need them for accounting, deposit disputes and legal requirements.',
        ],
      },
      {
        id: 'your-rights',
        heading: 'Your rights',
        body: [
          'Under the Data Privacy Act you have the right to:',
          {
            list: [
              'Be informed about how your personal data is processed.',
              'Access the personal data we hold about you.',
              'Correct inaccurate details. Most can be updated directly from My Profile.',
              'Object to processing, or ask us to delete or block your data where the law allows.',
              'File a complaint with the National Privacy Commission.',
            ],
          },
          `To make a request, email ${SUPPORT_EMAIL} from the address linked to your account.`,
        ],
      },
      {
        id: 'browser-storage',
        heading: 'Cookies and browser storage',
        body: [
          'We use your browser\'s storage to keep you signed in and to remember preferences such as light or dark theme. We do not use advertising or tracking cookies.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes to this policy',
        body: [
          'If we make material changes we will update the date at the top of this page and, where appropriate, notify you in the app.',
        ],
      },
    ],
  },

  terms: {
    title: 'Terms of Service',
    eyebrow: 'Legal',
    intro: 'These terms govern your use of Gear Rent. By creating an account or using the platform, you agree to them. Please read them together with our Rental Agreement and Privacy Policy.',
    sections: [
      {
        id: 'accounts',
        heading: 'Your account',
        body: [
          {
            list: [
              'You must be at least 18 years old, or have the consent of a parent or guardian, to rent or list equipment.',
              'Keep your details accurate and your sign-in credentials private. You are responsible for activity on your account.',
              'One person per account. Accounts may not be shared, sold or transferred.',
            ],
          },
        ],
      },
      {
        id: 'memberships',
        heading: 'Memberships',
        body: [
          'Every account starts on the free Gear Rent Guest plan. Paid memberships last one month from the date of payment.',
          {
            list: [
              'Gear Rent Guest: free. Browse the catalog and view gear details. Guests cannot rent.',
              `Gear Rent Renter: ${renterFee} per month. Rent gear, with refundable security deposits and rental history.`,
              `Gear Rent Provider: ${providerFee} per month, or ${upgradeFee} when upgrading from an active Renter membership. Includes everything in Renter, plus listing your own equipment.`,
            ],
          },
          'Once you buy Gear Rent Renter or Gear Rent Provider, your account cannot be switched back to Gear Rent Guest from the Memberships page. If your membership needs to be changed, contact the crew and an administrator will help. Membership fees already paid are not refunded.',
        ],
      },
      {
        id: 'renting',
        heading: 'Renting equipment',
        body: [
          `Rentals are priced per day and can run from 1 to 90 days. Each checkout includes a ${serviceFee} service fee and a refundable security deposit for every item. All amounts are shown before you pay. Every rental is also governed by the Rental Agreement.`,
        ],
      },
      {
        id: 'listing',
        heading: 'Listing equipment',
        body: [
          'Gear Rent Providers may list equipment they own or have the right to rent out.',
          {
            list: [
              'Listings are reviewed by Gear Rent before they appear in the catalog. Editing an approved listing sends it back for review.',
              'Descriptions, specifications and photos must be accurate and must be your own uploads.',
              'Rental earnings are added to your Gear Rent balance when your gear is rented.',
              'You are responsible for inspecting returned gear and confirming the return promptly and honestly.',
              'You may not rent your own listings.',
            ],
          },
        ],
      },
      {
        id: 'balance',
        heading: 'Payments and your balance',
        body: [
          'Refunds, returned deposits and provider earnings are credited to your Gear Rent account balance. You can transfer your available balance to your bank from My Profile. Transfers cannot exceed your balance, and a limited number of transfer requests can be made per hour.',
        ],
      },
      {
        id: 'acceptable-use',
        heading: 'Acceptable use',
        body: [
          'You agree not to:',
          {
            list: [
              'Provide false information, impersonate others or create accounts for someone else without permission.',
              'List equipment you do not have the right to rent, or misrepresent its condition.',
              'Use rented equipment for unlawful purposes.',
              'Interfere with the platform, attempt to access other members\' data, or bypass payments or security measures.',
            ],
          },
        ],
      },
      {
        id: 'suspension',
        heading: 'Suspension and termination',
        body: [
          'We may suspend or close accounts, remove listings or decline rentals if these terms or the Rental Agreement are broken, or to protect other members. You may stop using Gear Rent at any time; obligations for open rentals continue until they are settled.',
        ],
      },
      {
        id: 'liability',
        heading: 'Limitation of liability',
        body: [
          'Gear Rent connects renters with equipment owners and provides the platform "as is". To the extent permitted by law, Gear Rent is not liable for indirect or consequential losses, such as lost profits or missed productions, arising from the use of rented equipment or the platform.',
        ],
      },
      {
        id: 'governing-law',
        heading: 'Governing law',
        body: [
          'These terms are governed by the laws of the Republic of the Philippines.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes to these terms',
        body: [
          'We may update these terms from time to time. Continued use of Gear Rent after an update means you accept the revised terms.',
        ],
      },
    ],
  },

  agreement: {
    title: 'Rental Agreement',
    eyebrow: 'Rentals',
    intro: 'This agreement applies to every rental made through Gear Rent, between the renter and the equipment owner, which is either a Gear Rent Provider or Gear Rent itself. Confirming a checkout means you accept it.',
    sections: [
      {
        id: 'booking',
        heading: 'Booking and payment',
        body: [
          {
            list: [
              'Rental fee: the item\'s daily rate multiplied by the number of rental days (1 to 90).',
              `Service fee: ${serviceFee} per checkout.`,
              'Security deposit: 2% of the item\'s daily rate, rounded up to the nearest ₱100, with a minimum of ₱100 per item.',
              'Everything is paid upfront at checkout. Once paid, the item is reserved for you and cannot be booked by anyone else until it is returned.',
            ],
          },
        ],
      },
      {
        id: 'pickup',
        heading: 'Pickup',
        body: [
          'Bring a valid government-issued ID. Check the equipment and its accessories with our team before leaving, and report any existing damage or missing parts at pickup so it is not attributed to you.',
        ],
      },
      {
        id: 'care',
        heading: 'Use and care',
        body: [
          {
            list: [
              'Use the equipment only for its intended purpose and according to the manufacturer\'s guidance.',
              'Keep it secure and protected from water, heat, sand and impact unless it is designed for those conditions.',
              'Do not sublet, lend or modify the equipment.',
              `Report faults, damage, loss or theft right away at ${SUPPORT_EMAIL}.`,
            ],
          },
        ],
      },
      {
        id: 'returns',
        heading: 'Returning gear',
        body: [
          'Return every item with all included accessories by the end of your rental period. Press "Return gear" in My Gears when you hand it back. The owner then inspects the equipment, records when it was received and confirms the return. Your rental closes once the return is confirmed.',
        ],
      },
      {
        id: 'late-returns',
        heading: 'Late returns',
        body: [
          'Late fees are charged at the item\'s daily rate for each day late, counted up to when the owner receives the gear. There is a one-hour grace period; after that, any part of a day counts as a full day.',
        ],
      },
      {
        id: 'damage',
        heading: 'Damage and loss',
        body: [
          'If equipment comes back damaged or incomplete, the inspector records a damage charge along with a written reason, which you can see on your rental. Late fees are deducted from your security deposit first, followed by damage charges, up to the amount of the deposit. For loss or damage beyond the deposit, the owner may seek the remaining cost separately.',
        ],
      },
      {
        id: 'deposit',
        heading: 'Getting your deposit back',
        body: [
          'Whatever remains of your deposit after any late fee or damage charge is returned to your Gear Rent balance as soon as the return is confirmed. Your rental will show whether the deposit was refunded in full, partially kept or kept.',
        ],
      },
      {
        id: 'early-returns',
        heading: 'Early returns',
        body: [
          'If you return gear before your rental period ends, the unused days are refunded to your Gear Rent balance.',
        ],
      },
    ],
  },
};

export const contactChannels = [
  {
    label: 'Email',
    title: SUPPORT_EMAIL,
    text: 'The fastest way to reach the crew. We reply within one business day.',
    href: `mailto:${SUPPORT_EMAIL}`,
    action: 'Send an email',
  },
  {
    label: 'Help Center',
    title: 'Answers to common questions',
    text: 'Clear answers on deposits, late fees, memberships, listings and transfers.',
    to: '/support',
    action: 'Visit Support',
  },
  {
    label: 'Pickup & returns',
    title: 'Cavite hub',
    text: 'How pickup works and what to bring when you collect your gear.',
    to: '/locations',
    action: 'See locations',
  },
];

export const contactTopics = [
  ['Rentals and returns', 'Booking questions, due dates, returns waiting for inspection, deposit refunds.'],
  ['Memberships and billing', 'Upgrading, switching plans, membership payments.'],
  ['Listing gear', 'Listing approval, editing listings, provider earnings and transfers.'],
  ['Account and privacy', 'Sign-in problems, profile changes, data access or deletion requests.'],
];

export const contactChecklist = [
  'Your full name and the email address on your account',
  'The item name and rental dates, if your question is about a booking',
  'A short description of the issue, with photos if something is damaged',
];

export const pickupSteps = [
  ['Book online', 'Rent your gear on Gear Rent. Pickup arrangements are confirmed with your booking.'],
  ['Contact the crew', 'Let us know when you plan to come so your equipment is prepared and tested.'],
  ['Bring a valid ID', 'A government-issued ID is required to release equipment.'],
  ['Check the gear together', 'Inspect every item and accessory with our team before you leave.'],
];

export const returnSteps = [
  ['Bring everything back', 'Return the equipment with all accessories by the end of your rental period.'],
  ['Press "Return gear"', 'Mark the rental as returned in My Gears when you hand it over.'],
  ['Inspection', 'The owner checks the gear and confirms the return.'],
  ['Deposit refund', 'Your deposit, less any late fee or damage charge, goes back to your balance.'],
];

export const supportTopics = [
  { title: 'Renting gear', text: 'Memberships, checkout, fees and deposits.', to: '/rental-agreement' },
  { title: 'Returns & deposits', text: 'Returning gear, inspections, late fees and refunds.', to: '/rental-agreement#returns' },
  { title: 'Memberships', text: 'Guest, Renter and Provider plans and pricing.', to: '/memberships' },
  { title: 'Account & privacy', text: 'Your data, sign-in and profile details.', to: '/privacy' },
];

export const faqs = [
  {
    q: 'Why can\'t I rent anything?',
    a: `New accounts start on the free Gear Rent Guest plan, which is for browsing. Become a Gear Rent Renter (${renterFee} per month) on the Memberships page to rent gear.`,
  },
  {
    q: 'What do I pay at checkout?',
    a: `The daily rate times the number of days for each item, a ${serviceFee} service fee per checkout, and a refundable security deposit for each item (2% of its daily rate, rounded up to the nearest ₱100, minimum ₱100).`,
  },
  {
    q: 'How do I return gear?',
    a: 'Hand the equipment back with all its accessories and press "Return gear" in My Gears. The owner inspects it and confirms the return, which closes your rental.',
  },
  {
    q: 'When do I get my deposit back?',
    a: 'As soon as the owner confirms your return, your deposit, minus any late fee or damage charge, is added to your Gear Rent balance.',
  },
  {
    q: 'What happens if I return gear late?',
    a: 'You are charged the daily rate for each day late, after a one-hour grace period. Any part of a day counts as a full day. Late fees come out of your deposit.',
  },
  {
    q: 'How do I become a Gear Rent Provider?',
    a: `Upgrade on the Memberships page: ${providerFee} per month, or ${upgradeFee} if you are already a Gear Rent Renter. Your first listing is reviewed before it goes live in the catalog.`,
  },
  {
    q: 'Why isn\'t my listing showing in the catalog?',
    a: 'New listings, and approved listings you have edited, are reviewed by Gear Rent before they appear. You will get a notification when a listing is approved or rejected.',
  },
  {
    q: 'How do I move my balance to my bank?',
    a: 'Open My Profile and choose "Transfer to bank". You can transfer up to your available balance.',
  },
  {
    q: 'Can I switch back to Guest or cancel my membership?',
    a: `Not from your account. Paid memberships stay on your plan, and lower tiers are already included. If you need your membership changed, email ${SUPPORT_EMAIL} and an administrator will update it. Fees already paid are not refunded.`,
  },
];
