import React from 'react';
import ArchiveEntry, { type ArchiveEntryProps } from './ArchiveEntry';

export interface ArchiveSectionProps {
  entries: ArchiveEntryProps[];
}

export const ArchiveSection: React.FC<ArchiveSectionProps> = ({ entries }) => {
  return (
    <section className="editorial-section archive-section">
      <div className="editorial-container archive-section__grid">
        <div className="archive-section__intro">
          <h2 className="archive-section__title">Comparative Baselines</h2>
          <p className="archive-section__eyebrow">
            Historical precedent, red-team warning, forecast layer.
          </p>
          <div className="archive-section__copy">
            <p>
              A sequence like this only becomes durable if it survives comparison. That
              means looking for both historical forms that make it more plausible and
              warning labels that make overreach easier to spot.
            </p>
            <p>
              The goal is not to flatten everything into one chain. The goal is to locate
              where the argument gains traction, where it starts flattering itself, and
              where it can be forced into real questions.
            </p>
          </div>
        </div>
        <div className="archive-section__list">
          {entries.map((entry) => (
            <ArchiveEntry key={entry.index} {...entry} />
          ))}
        </div>
      </div>
    </section>
  );
};
