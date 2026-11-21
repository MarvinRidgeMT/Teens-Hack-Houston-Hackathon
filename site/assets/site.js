// Pickup site motion. Everything here is optional polish: the page is complete without it,
// and none of it runs under prefers-reduced-motion. All three libraries are local files in
// assets/vendor/; the page still makes no third-party requests.
//   - Lenis (darkroom.engineering, MIT): smooth wheel scrolling, driven by GSAP's ticker.
//   - GSAP 3.13 + ScrollTrigger (GreenSock standard no-charge licence): the motion itself.
//   - The hero headline uses the "blur" effect of React Bits' BlurText (David Haz,
//     MIT + Commons Clause), ported from React + motion/react to plain GSAP.
//   - Section reveal follows UI UX Pro Max's "Scroll Reveal (Subtle)" preset: 12px, 0.35s.
(() => {
  const { gsap, ScrollTrigger, Lenis } = window;
  if (!gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);

  // Smooth scrolling. Lenis handles in-page anchor links itself; GSAP's ticker drives it so
  // ScrollTrigger and Lenis read the same scroll position on the same frame.
  if (Lenis) {
    const lenis = new Lenis({ autoRaf: false, anchors: { offset: -16 } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // BlurText (React Bits), "blur" effect, by words: each word starts blurred, transparent and
  // a little above, passes half-blurred, and settles. Screen readers get the plain sentence (aria-label).
  // Words inside the <mark class="hl"> stay inside it; once they land, the lime highlighter
  // stroke draws across them left to right (the page's one authored moment).
  const title = document.getElementById('hero-title');
  if (title && !title.dataset.split) {
    const text = title.textContent.replace(/\s+/g, ' ').trim();
    title.dataset.split = '1';
    title.setAttribute('aria-label', text);
    const words = [];
    const splitInto = (target, str) => str.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { target.append(' '); return; }
      const span = Object.assign(document.createElement('span'), { className: 'bt-word', textContent: part });
      span.setAttribute('aria-hidden', 'true');
      target.append(span);
      words.push(span);
    });
    const nodes = [...title.childNodes];
    title.textContent = '';
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) splitInto(title, node.textContent);
      else { const copy = node.cloneNode(false); title.append(copy); splitInto(copy, node.textContent); }
    }
    const mark = title.querySelector('.hl');
    if (mark) {
      // Until the stroke arrives the words sit on violet, so they start white and turn ink with it.
      gsap.set(mark, { backgroundSize: '0% 100%', color: '#ffffff' });
      gsap.to(mark, { backgroundSize: '100% 100%', color: '#15122e', duration: 0.5, ease: 'power3.out',
        delay: 0.1 + words.length * 0.12 + 0.2, clearProps: 'backgroundSize,color' });
    }
    gsap.set(words, { filter: 'blur(10px)', opacity: 0, y: -18 });
    gsap.to(words, {
      keyframes: [
        { filter: 'blur(5px)', opacity: 0.5, y: 2, duration: 0.35, ease: 'none' },
        { filter: 'blur(0px)', opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
      ],
      stagger: 0.12,
      delay: 0.1,
      clearProps: 'filter,opacity,transform',
    });
    gsap.from('.hero .lede, .hero .ctas, .hero .chips', {
      opacity: 0, y: 8, duration: 0.35, ease: 'power1.out', stagger: 0.06, delay: 0.1 + words.length * 0.12,
      clearProps: 'opacity,transform',
    });
  }

  // Sections below the hero rise 12px and fade in as they enter the viewport.
  gsap.utils.toArray('main > section:not(.hero)').forEach((el) => {
    gsap.from(el, {
      opacity: 0, y: 12, duration: 0.35, ease: 'power1.out',
      scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' },
    });
  });
})();
