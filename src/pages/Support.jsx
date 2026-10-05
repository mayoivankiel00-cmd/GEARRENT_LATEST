import { Link } from 'react-router-dom';
import { HelpCallout, InfoHero } from './InfoPage';
import { faqs, SUPPORT_EMAIL, supportTopics } from './infoContent';
import './InfoPages.css';

export default function Support() {
  return (
    <div className="container info-page">
      <InfoHero
        eyebrow="Help Center"
        title="How can we help?"
        intro="Find answers about renting, returns, deposits and memberships, or reach the crew directly."
      />

      <div className="info-card-grid info-card-grid-4">
        {supportTopics.map((topic) => (
          <Link className="card info-card info-card-clickable" to={topic.to} key={topic.title}>
            <strong className="info-card-title">{topic.title}</strong>
            <p>{topic.text}</p>
            <span className="info-card-link mono">Learn more →</span>
          </Link>
        ))}
      </div>

      <div className="info-faq-layout">
        <div>
          <span className="eyebrow">FAQ</span>
          <h2 className="info-faq-heading">Frequently asked questions</h2>
          <p className="info-faq-sub">
            Can&apos;t find what you need? Email <a className="info-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </div>
        <div className="info-faq">
          {faqs.map((faq) => (
            <details key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      <HelpCallout />
    </div>
  );
}
