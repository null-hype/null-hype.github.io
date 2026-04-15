import React from 'react';

export interface EditorialSidebarItem {
  label: string;
  href: string;
  icon?: string;
  active?: boolean;
}

export interface EditorialSidebarProps {
  brandMark?: string;
  reference?: string;
  navItems?: EditorialSidebarItem[];
}

export const EditorialSidebar: React.FC<EditorialSidebarProps> = ({
  brandMark = 'JRW',
  reference = 'Ref: PLAN-26 v3.5',
  navItems = [],
}) => {
  return (
    <aside className="editorial-sidebar" aria-label="Dossier shortcuts">
      <div className="editorial-sidebar__inner">
        <div className="editorial-sidebar__brand">
          <span className="editorial-sidebar__brand-mark">{brandMark}</span>
          <span className="editorial-sidebar__ref">{reference}</span>
        </div>
        {navItems.length > 0 && (
          <nav className="editorial-sidebar__nav" aria-label="Section shortcuts">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={item.active ? 'is-active' : undefined}
              >
                {item.icon && (
                  <span
                    className="editorial-sidebar__icon material-symbols-outlined"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                )}
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
};
