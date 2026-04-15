import React from 'react';

export interface EditorialTopbarProps {
  brandText?: string;
  brandHref?: string;
  navItems?: { label: string; href: string; active?: boolean }[];
  actionText?: string;
  actionHref?: string;
}

export const EditorialTopbar: React.FC<EditorialTopbarProps> = ({
  brandText = 'jungle.roaring.wave',
  brandHref = '/now',
  navItems = [],
  actionText = 'Now page',
  actionHref = '/now',
}) => {
  return (
    <header className="editorial-topbar">
      <div className="editorial-topbar__inner">
        <div className="editorial-topbar__group">
          <a className="editorial-topbar__brand" href={brandHref}>
            {brandText}
          </a>
          {navItems.length > 0 && (
            <nav className="editorial-nav" aria-label="Primary dossier sections">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={item.active ? 'is-active' : undefined}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
        {actionText && (
          <div className="editorial-topbar__actions">
            <a className="editorial-pdf-link" href={actionHref}>
              {actionText}
            </a>
          </div>
        )}
      </div>
    </header>
  );
};
