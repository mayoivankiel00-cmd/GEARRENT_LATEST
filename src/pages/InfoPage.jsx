const pageContent = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Gear Rent policy',
    intro: 'We use the information you provide to manage your account, process rentals, and contact you about bookings.',
    sections: [
      ['Information we keep', 'Your name, email address, phone number, and delivery details help us provide the rental service and keep your account accurate.'],
      ['Your information', 'In this demo, profile information is stored locally in your browser. You can update it from My Profile at any time.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    eyebrow: 'Gear Rent terms',
    intro: 'By using Gear Rent, you agree to use the service responsibly and provide accurate account and rental information.',
    sections: [
      ['Accounts', 'Keep your account details current and protect access to your account. You are responsible for activity made through your account.'],
      ['Rentals', 'Rental availability, pricing, pickup, return, and care requirements are confirmed before each rental is completed.'],
    ],
  },
  agreement: {
    title: 'Rental Agreement',
    eyebrow: 'Gear Rent rentals',
    intro: 'Every rental is made with the understanding that equipment will be handled carefully and returned on time.',
    sections: [
      ['Before pickup', 'Review the item, rental dates, pricing, and deposit requirements before confirming your order.'],
      ['During and after rental', 'Use equipment according to its intended purpose, report problems promptly, and return every item with its included accessories.'],
    ],
  },
  contact: {
    title: 'Contact Us',
    eyebrow: 'Gear Rent crew',
    intro: 'Need help with a rental, return, or account? Our crew is ready to help.',
    sections: [
      ['Email', 'Reach us at support@gearrent.ph and we will get back to you within one business day.'],
      ['What to include', 'For faster help, include your name, rental or order details, and a short description of your question.'],
    ],
  },
  locations: {
    title: 'Locations',
    eyebrow: 'Gear Rent pickup',
    intro: 'Gear Rent serves creators in Cavite with convenient pickup and return coordination.',
    sections: [
      ['Cavite hub', 'Pickup and returns are coordinated with your booking confirmation. Contact the crew before visiting so we can prepare your equipment.'],
      ['Planning a pickup', 'Bring a valid ID and allow time to check the equipment with our team before leaving the hub.'],
    ],
  },
};

export default function InfoPage({ type }) {
  const content = pageContent[type];

  return (
    <div className="container" style={{ padding: '6rem 2rem', maxWidth: '1080px', flex: 1 }}>
      <div style={{ borderTop: '3px solid var(--accent)', paddingTop: '2rem' }}>
        <div className="eyebrow">{content.eyebrow}</div>
        <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)', lineHeight: 1, margin: '0.6rem 0 1.5rem' }}>{content.title}</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '65ch', fontSize: '1.1rem' }}>{content.intro}</p>
        {content.sections.map(([heading, text]) => (
          <section key={heading}>
            <h2 style={{ fontSize: '1.45rem', marginTop: '3rem' }}>{heading}</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '70ch', fontSize: '1rem' }}>{text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
