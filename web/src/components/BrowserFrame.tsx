import type { ReactNode } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { SPRING_CARD } from '../styles/motion';

export type BrowserTab = { id: string; title: string; group?: boolean; later?: boolean };

/** A drawn browser window for the page's simulations. Tabs move with shared layout (never deleted). */
export function BrowserFrame({ tabs, active, groupName, groupDim = false, reduced, children, label }: {
  tabs: BrowserTab[]; active: string; groupName?: string; groupDim?: boolean; reduced: boolean; children: ReactNode; label: string;
}) {
  const t = reduced ? { duration: 0 } : SPRING_CARD;
  const grouped = tabs.filter((x) => x.group);
  const rest = tabs.filter((x) => !x.group);
  const Tab = (x: BrowserTab) => (
    <motion.li layout key={x.id} transition={t}
      className={`bf__tab ${x.id === active ? 'is-active' : ''} ${x.group ? 'is-group' : ''} ${x.later ? 'is-later' : ''}`}
      aria-current={x.id === active ? 'page' : undefined}>
      {x.title}
    </motion.li>
  );
  return (
    <div className="bf" role="group" aria-label={label}>
      <div className="bf__chrome">
        <span className="bf__dots" aria-hidden="true"><i /><i /><i /></span>
        <LayoutGroup>
          <ul className="bf__tabs" aria-label="Tabs">
            {groupName && (
              <motion.li layout key="group" transition={t} className="bf__group" style={{ opacity: groupDim ? 0.55 : 1 }}>{groupName}</motion.li>
            )}
            {grouped.map(Tab)}
            {rest.map(Tab)}
          </ul>
        </LayoutGroup>
      </div>
      <div className="bf__body">{children}</div>
    </div>
  );
}
