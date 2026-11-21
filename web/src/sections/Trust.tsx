import { HardDrive, Globe, MousePointer2, Plus } from 'lucide-react';
import { LiquidGlass } from '../components/glass/LiquidGlass';
import { BrandMark, SectionHead } from '../components/ui';
import { LIMITS, PILOT_METHOD, PILOT_RESULTS, PRIVACY } from '../content/site';

function DataFlow() {
  return (
    <figure className="flow" aria-labelledby="flow-cap">
      <ol className="flow__row" role="list">
        <li className="flow__node"><MousePointer2 size={20} aria-hidden="true" /><span>The page you're working on</span></li>
        <li className="flow__node flow__node--pk"><BrandMark size={22} /><span>Pickup, inside Chrome</span></li>
        <li className="flow__node flow__node--store"><HardDrive size={20} aria-hidden="true" /><span><code>chrome.storage.local</code>, on this computer</span></li>
      </ol>
      <p className="flow__never"><Globe size={18} aria-hidden="true" /> No Pickup server. No requests out.</p>
      <figcaption id="flow-cap" className="sr-only">
        Data goes from the page you're working on to Pickup inside Chrome, and is stored in Chrome's local storage on this computer. Nothing goes to a server.
      </figcaption>
    </figure>
  );
}

export function Privacy() {
  return (
    <section className="section privacy" id="privacy" aria-labelledby="privacy-title">
      <div className="atmo" aria-hidden="true">
        <span className="atmo__light atmo__light--mint" style={{ width: '60vw', height: '60vw', left: '20vw', top: '-20vw' }} />
      </div>
      <div className="wrap privacy__grid">
        <div>
          <SectionHead id="privacy-title" label="Privacy" title={<>Your space <span className="soft">stays yours.</span></>}
            lede="Pickup keeps your place on your computer and nowhere else. Open any line for the details." />
          <DataFlow />
        </div>
        <LiquidGlass variant="pearl" text radius={30} className="privacy__list">
          {PRIVACY.map((p) => (
            <details key={p.title} className="pv">
              <summary>
                <span className="pv__text"><strong>{p.title}</strong><span>{p.short}</span></span>
                <Plus className="pv__icon" size={20} aria-hidden="true" />
              </summary>
              <p>{p.detail}</p>
            </details>
          ))}
          <details className="pv">
            <summary>
              <span className="pv__text"><strong>Honest limits</strong><span>What Pickup can't do.</span></span>
              <Plus className="pv__icon" size={20} aria-hidden="true" />
            </summary>
            <ul>{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
          </details>
        </LiquidGlass>
      </div>
    </section>
  );
}

export function Evidence() {
  return (
    <section className="section evidence" id="evidence" aria-labelledby="ev-title">
      <div className="wrap evidence__grid">
        <SectionHead id="ev-title" label="Evidence" title={<>How we test it, <span className="soft">and what we found.</span></>}
          lede="A small pilot, run honestly. Three people who built the tool, about one day, randomised per comeback. A starting point, not proof." />
        <dl className="ev-method">
          {PILOT_METHOD.map((m) => (
            <div key={m.label} className="ev-method__row"><dt>{m.label}</dt><dd>{m.value}</dd></div>
          ))}
        </dl>
        {PILOT_RESULTS ? (
          <LiquidGlass variant="pearl" text radius={30} className="ev-result">
            <p className="h3">{PILOT_RESULTS.headline}</p>
            <p>{PILOT_RESULTS.detail}</p>
          </LiquidGlass>
        ) : (
          <div className="ev-slot" role="note">
            <p className="label">Results</p>
            <p className="ev-slot__text">The pooled pilot numbers (medians with IQR, n per condition, by time away) go here once the team posts them. Nothing is shown until they are real.</p>
          </div>
        )}
      </div>
    </section>
  );
}
