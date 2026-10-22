import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';

/** Decorative yarn only; no scrolling interception or content gating. */
export function ScrollStitch() {
  const target = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ height: 4000, viewport: 720 });
  const id = useId().replace(/:/g, '');
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const measure = () => setDimensions({ height: element.clientHeight, viewport: window.innerHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const { scrollYProgress } = useScroll({
    target,
    offset: ['start start', 'end end'],
  });
  const opening = Math.min(0.18, dimensions.viewport * 0.65 / dimensions.height);
  const greenRemaining = useTransform(scrollYProgress, [0, 1], [1 - opening, 0]);
  const orangeRemaining = useTransform(scrollYProgress, [0, 0.035, 1], [1 - opening * 0.8, 1 - opening * 0.8, 0]);
  const green = useSpring(greenRemaining, { stiffness: 85, damping: 26, restDelta: 0.0001 });
  const orange = useSpring(orangeRemaining, { stiffness: 70, damping: 25, restDelta: 0.0001 });
  // Continuous edge seams: evenly spaced loops without crossing page content.
  const left = ['M 18 0'];
  const right = ['M 982 0'];
  for (let y = 0; y < dimensions.height; y += 640) {
    const end = Math.min(y + 640, dimensions.height);
    left.push(`C 18 ${y + 100} 62 ${y + 120} 62 ${y + 200} S 12 ${y + 310} 18 ${y + 380} S 52 ${y + 510} 18 ${end}`);
    right.push(`C 982 ${y + 100} 938 ${y + 180} 938 ${y + 250} S 990 ${y + 370} 982 ${y + 440} S 948 ${y + 540} 982 ${end}`);
  }
  const paths = [left.join(' '), right.join(' ')];

  return (
    <div ref={target} className="scroll-stitch" aria-hidden="true">
      <svg viewBox={`0 0 1000 ${dimensions.height}`} preserveAspectRatio="none" focusable="false">
        <defs>
          {paths.map((d, i) => (
            <mask id={`${id}-${i}`} key={i} maskUnits="userSpaceOnUse" x="-50" y="-50" width="1100" height={dimensions.height + 100}>
              <motion.path d={d} pathLength={1} className="stitch-reveal" strokeDasharray="1" style={{ strokeDashoffset: reducedMotion ? 0 : i === 0 ? green : orange }} />
            </mask>
          ))}
        </defs>
        {paths.map((d, i) => (
          <g key={i} mask={`url(#${id}-${i})`} className={i === 0 ? 'stitch-green' : 'stitch-orange'}>
            <path d={d} className="stitch-shadow" />
            <path d={d} className="stitch-yarn" />
            <path d={d} className="stitch-fibers" />
          </g>
        ))}
      </svg>
    </div>
  );
}