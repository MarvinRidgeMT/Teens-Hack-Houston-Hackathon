import { ArrowDownToLine, ExternalLink, FolderGit2 } from 'lucide-react';
import { LiquidGlass } from '../components/glass/LiquidGlass';
import { GlassButton } from '../components/glass/GlassButton';
import { BrandMark, KeyHint, SectionHead, ShortcutHint } from '../components/ui';
import { INSTALL_STEPS, LINKS, PLATFORM_NAME, SHORTCUTS, SHORTCUTS_NOTE, WORKS_ON, type Platform } from '../content/site';

const TABLE_PLATFORMS: readonly Platform[] = ['mac', 'other'];

/** The download CTA: real link when the release is public, an honest pending state until then. */
export function DownloadCta({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  if (LINKS.downloadLive) {
    return <GlassButton href={LINKS.download} tone="mint" size={size} magnetic icon={<ArrowDownToLine size={19} />}>Download Pickup</GlassButton>;
  }
  return (
    <span className="gbtn gbtn--pending gbtn--lg" role="note">
      <ArrowDownToLine size={18} aria-hidden="true" />
      <span className="gbtn__label">Download goes live with the v1.0 release</span>
    </span>
  );
}

export function Install() {
  return (
    <section className="section install" id="install" aria-labelledby="install-title">
      <div className="wrap install__grid">
        <div>
          <SectionHead id="install-title" title="Set up in about a minute."
            lede="Chrome 123 or newer, on a laptop or desktop. Pickup loads unpacked from a zip; it isn't on the Chrome Web Store. Free, no account." />
          <div className="install__cta">
            <DownloadCta />
            {LINKS.repoPublic && <GlassButton href={LINKS.repo} tone="pearl" size="lg" target="_blank" rel="noopener noreferrer" icon={<FolderGit2 size={18} />}>View on GitHub</GlassButton>}
          </div>
          {!LINKS.downloadLive && <p className="install__fine">The zip will be on our GitHub release page once the repo is public. It isn't there yet.</p>}
          <p className="install__fine"><strong>Works on:</strong> {WORKS_ON}</p>
        </div>
        <ol className="install__steps" role="list">
          {INSTALL_STEPS.map((s, i) => (
            <li key={s.title}>
              <LiquidGlass variant="pearl" text radius={22} className="istep">
                <span className="istep__n tnum">{i + 1}</span>
                <span><strong>{s.title}</strong><span>{s.body}</span></span>
              </LiquidGlass>
            </li>
          ))}
        </ol>
      </div>
      <div className="wrap shortcuts">
        <h3 className="h3">The keys, and the other way to do each</h3>
        <LiquidGlass variant="pearl" text radius={30} className="legend">
          <table className="legend__table">
            <caption className="sr-only">Keyboard shortcuts and the other way to do each</caption>
            <thead><tr>{TABLE_PLATFORMS.map((p) => <th key={p} scope="col">{PLATFORM_NAME[p]}</th>)}<th scope="col">What it does</th><th scope="col">Without the keyboard</th></tr></thead>
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.label}>
                  {TABLE_PLATFORMS.map((p) => (
                    <td key={p} className="legend__keys">
                      <span className="legend__os">{PLATFORM_NAME[p]}</span>
                      {s.id ? <KeyHint id={s.id} platform={p} /> : <ShortcutHint keys={s.keys ?? []} />}
                    </td>
                  ))}
                  <th scope="row">{s.label}</th><td>{s.alt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </LiquidGlass>
        <p className="shortcuts__tip">{SHORTCUTS_NOTE}</p>
        <p className="shortcuts__tip">Try it without your own data: open the dashboard and click <strong>Load sample data</strong>.</p>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="section final" aria-labelledby="final-title">
      <div className="atmo" aria-hidden="true">
        <span className="atmo__light atmo__light--lilac" style={{ width: '50vw', height: '50vw', left: '-6vw', top: '-10%' }} />
        <span className="atmo__light atmo__light--mint" style={{ width: '40vw', height: '40vw', right: '-4vw', bottom: '-20%' }} />
        <span className="atmo__light atmo__light--blush" style={{ width: '26vw', height: '26vw', left: '40vw', bottom: '-10%' }} />
      </div>
      <div className="wrap">
        <LiquidGlass variant="crystal" radius="48px 48px 48px 28px" interactive className="final__panel">
          <h2 id="final-title" className="display final__title">Come back to <span className="soft">what matters.</span></h2>
          <p className="lede final__lede">Pickup keeps your place, so an interruption costs you a key press, not your train of thought.</p>
          <div className="final__ctas">
            <DownloadCta />
            <GlassButton href="#return-card" tone="pearl" size="lg">Try the card again</GlassButton>
          </div>
        </LiquidGlass>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div>
          <a className="gnav__brand" href="#top"><BrandMark size={30} /> Pickup</a>
          <p className="footer__tag">Undo the interruption, not the mistake.</p>
          <p className="footer__made">Built for Triple H 2026 by Anish (engine), Sidd (return card and park overlay) and Abhinav (setup, evidence and story).</p>
        </div>
        <nav aria-label="Footer" className="footer__nav">
          <a href="#install">Download</a>
          {LINKS.repoPublic && <a href={LINKS.repo} target="_blank" rel="noopener noreferrer">GitHub <ExternalLink size={12} aria-hidden="true" /></a>}
          {LINKS.devpost && <a href={LINKS.devpost} target="_blank" rel="noopener noreferrer">Devpost</a>}
          <a href="#privacy">Privacy</a>
        </nav>
      </div>
      <p className="wrap footer__legal">
        © 2026 the Pickup team. Type: Plus Jakarta Sans and Geist (SIL Open Font License). Built with React, Three.js, React Three Fiber, GSAP, Lenis, Motion and Lucide icons.
        The laptop is modelled in Blender by the team; the screens on it are real screenshots of Pickup.
      </p>
    </footer>
  );
}
