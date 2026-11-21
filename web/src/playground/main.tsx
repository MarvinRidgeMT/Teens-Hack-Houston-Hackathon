// DEV ONLY material playground (`npm run dev`, then /playground.html). Not linked, not in the build.
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, Layers } from 'lucide-react';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/glass.css';
import '../styles/components.css';
import '../styles/hero.css';
import './playground.css';
import { GlassDefs, LiquidGlass } from '../components/glass/LiquidGlass';
import { GlassButton } from '../components/glass/GlassButton';
import { GlassNavbar } from '../components/glass/GlassNavbar';

function Playground() {
  return (
    <>
      <GlassDefs />
      <GlassNavbar />
      <main className="pg">
        <div className="atmo" aria-hidden="true">
          <span className="atmo__light atmo__light--lilac" style={{ width: '50vw', height: '50vw', left: '-10vw', top: '-10vw' }} />
          <span className="atmo__light atmo__light--mint" style={{ width: '40vw', height: '40vw', right: '-5vw', top: '30vh' }} />
          <span className="atmo__light atmo__light--blush" style={{ width: '30vw', height: '30vw', left: '30vw', bottom: '-10vw' }} />
        </div>
        <h1 className="display pg__h">Undo the interruption, <span className="soft">not the mistake.</span></h1>
        <div className="pg__row">
          <LiquidGlass variant="pearl" interactive text radius={30} className="pg__tile"><p className="label">Pearl</p><p className="h3">Nav, panels</p><p>Moderate blur, thin bright rim, soft shadow.</p></LiquidGlass>
          <LiquidGlass variant="gel" tint="mint" interactive text radius={30} className="pg__tile"><p className="label">Gel · mint</p><p className="h3">Controls, demos</p><p>Tinted, rounder, stronger highlight.</p></LiquidGlass>
          <LiquidGlass variant="gel" tint="blush" interactive text radius={30} className="pg__tile"><p className="label">Gel · blush</p><p className="h3">Accents</p><p>Used sparingly, under plum text.</p></LiquidGlass>
          <LiquidGlass variant="crystal" interactive radius={40} className="pg__tile pg__tile--crystal"><p className="label">Crystal (lens where supported)</p><p className="h3">Signature only</p><p>Clearest, strongest rim.</p></LiquidGlass>
        </div>
        <div className="pg__row">
          <GlassButton href="#" tone="mint" size="lg" magnetic icon={<ArrowDownToLine size={19} />}>Download Pickup</GlassButton>
          <GlassButton href="#" tone="blush" size="lg">Blush gel</GlassButton>
          <GlassButton href="#" tone="pearl" size="lg">Pearl</GlassButton>
          <div className="hero-obj" style={{ position: 'relative' }}>
            <LiquidGlass variant="gel" tint="lilac" radius={22} text className="ctx ctx--task"><span className="ctx__icon"><Layers size={18} /></span><span><strong>Climate Essay</strong><small>4 tabs · tab group</small></span></LiquidGlass>
            <span className="lg-contact" />
          </div>
        </div>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Playground />);
