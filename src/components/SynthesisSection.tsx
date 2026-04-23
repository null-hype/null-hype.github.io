import React from 'react';
import WatchlistPanel, { type WatchlistPanelProps } from './WatchlistPanel';

export interface SynthesisSectionProps {
  synthesisContent?: {
    title: string;
    paragraphs: string[];
  };
  watchlistContent?: WatchlistPanelProps;
}

export const SynthesisSection: React.FC<SynthesisSectionProps> = ({
  synthesisContent,
  watchlistContent,
}) => {
  return (
    <section id="forecast" className="editorial-section">
      <div className="editorial-container synthesis-section__grid">
        {synthesisContent ? (
          <div className="synthesis-section__copy">
            <h2 className="synthesis-section__title">{synthesisContent.title}</h2>
            <div className="synthesis-copy">
              {synthesisContent.paragraphs.map((paragraph, index) => (
                <p
                  key={paragraph}
                  className={
                    index === synthesisContent.paragraphs.length - 1 ? 'is-muted' : undefined
                  }
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        {watchlistContent ? (
          <div className="synthesis-section__panel">
            <WatchlistPanel {...watchlistContent} />
          </div>
        ) : null}
      </div>
    </section>
  );
};
