import React from 'react';

export interface ComparisonNote {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface ComparisonNotesSectionProps {
  notes: ComparisonNote[];
}

export const ComparisonNotesSection: React.FC<ComparisonNotesSectionProps> = ({ notes }) => {
  return (
    <section className="editorial-section editorial-section--bordered">
      <div className="editorial-container editorial-note-stack">
        {notes.map((note) => (
          <article key={note.id} id={note.id} className="editorial-note">
            <h3 className="editorial-note__title">{note.title}</h3>
            <div className="editorial-note__copy">
              {note.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
