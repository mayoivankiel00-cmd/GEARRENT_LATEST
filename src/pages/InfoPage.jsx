import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  contactChannels, contactChecklist, contactTopics, LAST_UPDATED, legalPages, pickupSteps, returnSteps, SUPPORT_EMAIL,
} from './infoContent';
import './InfoPages.css';

// Glide to a section on this page, keeping its #hash in the address bar so
// the link can be shared. Instant for people who prefer reduced motion.
function scrollToSection(event, id) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(window.history.state, '', `#${id}`);
}

// Links like /rental-agreement#returns land on that section.
function useScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) target.scrollIntoView({ block: 'start' });
  }, [hash, pathname]);
}

export function InfoHero({ eyebrow, title, intro, meta }) {
  return (
    <header className="info-hero">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {intro && <p className="info-intro">{intro}</p>}
      {meta && <p className="info-meta mono">{meta}</p>}
    </header>
  );
}

export function HelpCallout() {
  return (
    <aside className="info-callout">
      <div>
        <strong>Still have questions?</strong>
        <p>Our crew replies within one business day.</p>
      </div>
      <div className="info-callout-actions">
        <a className="btn btn-primary" href={`mailto:${SUPPORT_EMAIL}`}>Email the crew</a>
        <Link className="btn btn-outline" to="/support">Help Center</Link>
      </div>
    </aside>
  );
}

function SectionBody({ body }) {
  return body.map((item, index) => (
    typeof item === 'string'
      ? <p key={index}>{item}</p>
      : (
        <ul key={index}>
          {item.list.map((entry) => <li key={entry}>{entry}</li>)}
        </ul>
      )
  ));
}

function LegalPage({ content }) {
  return (
    <>
      <InfoHero eyebrow={content.eyebrow} title={content.title} intro={content.intro} meta={`Last updated ${LAST_UPDATED}`} />
      <div className="info-layout">
        <nav className="info-toc" aria-label="On this page">
          <span className="mono info-toc-title">On this page</span>
          <ol>
            {content.sections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`} onClick={(event) => scrollToSection(event, section.id)}>{section.heading}</a></li>
            ))}
          </ol>
        </nav>
        <div className="info-sections">
          {content.sections.map((section, index) => (
            <section className="info-section" id={section.id} key={section.id}>
              <h2>
                <span className="info-section-number mono">{String(index + 1).padStart(2, '0')}</span>
                {section.heading}
              </h2>
              <SectionBody body={section.body} />
            </section>
          ))}
          <section className="info-section" id="contact">
            <h2><span className="info-section-number mono">{String(content.sections.length + 1).padStart(2, '0')}</span>Contact</h2>
            <p>
              Questions about this page? Email <a className="info-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function ContactPage() {
  return (
    <>
      <InfoHero
        eyebrow="Contact"
        title="Contact Us"
        intro="Need help with a rental, a return or your account? The Gear Rent crew is here to help."
      />
      <div className="info-card-grid">
        {contactChannels.map((channel) => (
          <div className="card info-card" key={channel.label}>
            <span className="eyebrow">{channel.label}</span>
            <strong className="info-card-title">{channel.title}</strong>
            <p>{channel.text}</p>
            {channel.href
              ? <a className="info-card-link mono" href={channel.href}>{channel.action} →</a>
              : <Link className="info-card-link mono" to={channel.to}>{channel.action} →</Link>}
          </div>
        ))}
      </div>

      <div className="info-split">
        <section className="info-panel">
          <h2>What we can help with</h2>
          <dl className="info-topic-list">
            {contactTopics.map(([topic, text]) => (
              <div key={topic}>
                <dt>{topic}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="info-panel">
          <h2>For a faster reply, include</h2>
          <ul className="info-checklist">
            {contactChecklist.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>
    </>
  );
}

function StepList({ steps }) {
  return (
    <ol className="info-steps">
      {steps.map(([title, text], index) => (
        <li key={title}>
          <span className="info-step-number mono">{index + 1}</span>
          <div>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function LocationsPage() {
  return (
    <>
      <InfoHero
        eyebrow="Locations"
        title="Pickup & Returns"
        intro="Gear Rent serves creators across Cavite. Equipment is picked up and returned at our Cavite hub, coordinated with every booking."
      />
      <div className="card info-location">
        <div>
          <span className="eyebrow">Main hub</span>
          <strong className="info-card-title">Gear Rent Cavite</strong>
          <p>Cavite, Philippines</p>
        </div>
        <div className="info-location-details">
          <div>
            <span className="eyebrow">Pickup point</span>
            <p>Confirmed with your booking</p>
          </div>
          <div>
            <span className="eyebrow">Visits</span>
            <p>By arrangement. Contact the crew first.</p>
          </div>
          <a className="btn btn-primary" href={`mailto:${SUPPORT_EMAIL}`}>Arrange a pickup</a>
        </div>
      </div>

      <div className="info-split">
        <section className="info-panel">
          <h2>Picking up</h2>
          <StepList steps={pickupSteps} />
        </section>
        <section className="info-panel">
          <h2>Returning</h2>
          <StepList steps={returnSteps} />
          <p className="info-panel-note">
            Late fees and deposit rules are explained in the <Link className="info-link" to="/rental-agreement#late-returns">Rental Agreement</Link>.
          </p>
        </section>
      </div>
    </>
  );
}

export default function InfoPage({ type }) {
  useScrollToHash();
  const legal = legalPages[type];

  return (
    <div className="container info-page">
      {legal && <LegalPage content={legal} />}
      {type === 'contact' && <ContactPage />}
      {type === 'locations' && <LocationsPage />}
      <HelpCallout />
    </div>
  );
}
