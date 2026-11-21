import { ArrowDownToLine, ExternalLink, Play } from 'lucide-react';
import { BrandMark, ButtonLink, Mark, SectionHead } from '../components/ui';
import { LINKS } from '../content/site';

export function Demo() {
  return (
    <section className="demo-video" id="demo" aria-labelledby="demo-title">
      <div className="wrap">
        <SectionHead id="demo-title" title="The six-minute demo" />
        <div className="video">
          {LINKS.videoId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${LINKS.videoId}`}
              title="Pickup demo video"
              loading="lazy"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              <img src="assets/shot-resume.jpg" width={1600} height={1000} alt="" loading="lazy" />
              <p className="video__soon"><Play size={18} aria-hidden="true" /> The demo video is posted Saturday.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  <><strong>Download</strong> the zip and unzip it.</>,
  <>Open <code>chrome://extensions</code> in Chrome.</>,
  <>Turn on <strong>Developer mode</strong> (top right).</>,
  <>Click <strong>Load unpacked</strong> and pick the unzipped folder.</>,
];

export function Install() {
  return (
    <section className="install" id="install" aria-labelledby="install-title">
      <div className="wrap install__grid">
        <div>
          <SectionHead id="install-title" title={<>Your next task <Mark>is waiting.</Mark></>} lede="Pickup makes it easier to find your way back. It installs in about a minute." />
          <div className="install__ctas">
            <ButtonLink href={LINKS.download} variant="primary" icon={<ArrowDownToLine size={18} aria-hidden="true" />}>Download the zip</ButtonLink>
            <ButtonLink href="#demo" variant="on-violet" icon={<Play size={16} aria-hidden="true" />}>Watch the demo</ButtonLink>
          </div>
          <p className="install__fine">Chrome 123 or newer, on a laptop or desktop. Loaded unpacked from our GitHub release; not on the Chrome Web Store. Free, no account.</p>
        </div>
        <div>
          <ol className="install__steps">
            {STEPS.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <p className="install__tip">Try it without your own data: open the dashboard and click <strong>Load sample data</strong>.</p>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div className="footer__brand">
          <a className="footer__logo" href="#top"><BrandMark size={34} tone="lime" /> Pickup</a>
          <p className="footer__tag">The calm way back to your work.</p>
          <p className="footer__made">Built in 48 hours for Triple H 2026 by Anish (engine), Sidd (surface) and Abhinav (setup, evidence and story).</p>
        </div>
        <nav className="footer__cols" aria-label="Footer">
          <div>
            <h2 className="footer__h">Product</h2>
            <ul>
              <li><a href="#how">How it works</a></li>
              <li><a href="#try">Try it</a></li>
              <li><a href="#features">Features</a></li>
            </ul>
          </div>
          <div>
            <h2 className="footer__h">Trust</h2>
            <ul>
              <li><a href="#privacy">Privacy</a></li>
              <li><a href="#evidence">How we test</a></li>
            </ul>
          </div>
          <div>
            <h2 className="footer__h">Get it</h2>
            <ul>
              <li><a href="#install">Install</a></li>
              <li><a href={LINKS.repo}>GitHub <ExternalLink size={12} aria-hidden="true" /></a></li>
              <li>{LINKS.devpost ? <a href={LINKS.devpost}>Devpost</a> : <span className="footer__muted">Devpost (coming)</span>}</li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="wrap footer__legal">
        <p>
          Type: Bricolage Grotesque and Inter (SIL OFL). Built with React, Three.js, React Three Fiber, GSAP, Lenis, Motion and Lucide icons.
          The laptop is drawn in code; the screens on it are real screenshots of Pickup.
        </p>
      </div>
      <p className="footer__word" aria-hidden="true">pickup</p>
    </footer>
  );
}
