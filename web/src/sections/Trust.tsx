import { HardDrive, Globe, Laptop, Plus } from 'lucide-react';
import { Mark, SectionHead } from '../components/ui';
import { LIMITS, PILOT_METHOD, PILOT_RESULTS, PRIVACY } from '../content/site';

function DataFlow() {
  return (
    <figure className="flow" aria-labelledby="flow-cap">
      <div className="flow__row">
        <div className="flow__node">
          <Laptop size={22} aria-hidden="true" />
          <span>The page you're working on</span>
        </div>
        <span className="flow__arrow" aria-hidden="true" />
        <div className="flow__node flow__node--pickup">
          <span className="pk-mark pk-mark--lime" style={{ width: 22, height: 22 }} aria-hidden="true" />
          <span>Pickup, inside Chrome</span>
        </div>
        <span className="flow__arrow" aria-hidden="true" />
        <div className="flow__node flow__node--store">
          <HardDrive size={22} aria-hidden="true" />
          <span>chrome.storage.local, on this computer</span>
        </div>
      </div>
      <div className="flow__never">
        <Globe size={20} aria-hidden="true" />
        <span>No Pickup server. No requests out.</span>
      </div>
      <figcaption id="flow-cap" className="sr-only">
        Data goes from the page you're working on to Pickup inside Chrome, and is stored in Chrome's local storage on this computer. Nothing goes to a server.
      </figcaption>
    </figure>
  );
}

export function Privacy() {
  return (
    <section className="privacy" id="privacy" aria-labelledby="privacy-title">
      <div className="wrap privacy__grid">
        <div>
          <SectionHead tone="dark" id="privacy-title" title={<>Your work <Mark tone="lime">stays yours.</Mark></>} lede="Pickup keeps your place on your computer and nowhere else. Open any line for the details." />
          <DataFlow />
        </div>
        <div className="privacy__list">
          {PRIVACY.map((p) => (
            <details key={p.title} className="pv">
              <summary>
                <span className="pv__text"><strong>{p.title}</strong><span>{p.short}</span></span>
                <Plus className="pv__icon" size={20} aria-hidden="true" />
              </summary>
              <p>{p.detail}</p>
            </details>
          ))}
          <details className="pv pv--limits">
            <summary>
              <span className="pv__text"><strong>Honest limits</strong><span>What Pickup can't do.</span></span>
              <Plus className="pv__icon" size={20} aria-hidden="true" />
            </summary>
            <ul>{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
          </details>
        </div>
      </div>
    </section>
  );
}

export function Evidence() {
  return (
    <section className="evidence" id="evidence" aria-labelledby="evidence-title">
      <div className="wrap evidence__grid">
        <SectionHead id="evidence-title" title="How we're testing Pickup" lede="A small pilot, run honestly. Results go here when we have them, not before." />
        <dl className="method">
          {PILOT_METHOD.map((m) => (
            <div key={m.label} className="method__row">
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
        <div className="results" aria-live="polite">
          {PILOT_RESULTS ? (
            <>
              <p className="results__headline">{PILOT_RESULTS.headline}</p>
              <p>{PILOT_RESULTS.detail}</p>
            </>
          ) : (
            <>
              <p className="results__headline">Results are posted Saturday.</p>
              <p>Until then there are no numbers on this page, on purpose.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
