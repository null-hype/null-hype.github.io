import React from 'react';

export interface FooterLink {
  label: string;
  href: string;
}

export interface EditorialFooterProps {
  brand?: string;
  metaText?: string;
  legalText?: string;
  links?: FooterLink[];
}

export const EditorialFooter: React.FC<EditorialFooterProps> = ({
  brand = 'jungle.roaring.wave',
  metaText = 'PLAN-26 v3.5 rendered March 24, 2026.',
  legalText = 'This version treats the sequence as a candidate signal that must survive comparison, counterargument, and future scoring before it earns anything stronger than disciplined suspicion.',
  links = [],
}) => {
  return (
    <footer className="editorial-footer">
      <div className="editorial-container editorial-footer__grid">
        <div className="editorial-footer__copy">
          <span className="editorial-footer__brand">{brand}</span>
          <p className="editorial-footer__meta">{metaText}</p>
          <p className="editorial-footer__legal">{legalText}</p>
        </div>
        <div className="editorial-footer__links">
          {links.map((link) => (
            <a key={link.label} href={link.href}>
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};
