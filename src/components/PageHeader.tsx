import type { ReactNode } from 'react';

type PageHeaderProps = { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string; titleClassName?: string; descriptionClassName?: string; actionsClassName?: string };

export default function PageHeader({ eyebrow, title, description, actions, className = '', titleClassName = '', descriptionClassName = '', actionsClassName = '' }: PageHeaderProps) {
  return <section className={className}>
    {eyebrow && <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">{eyebrow}</p>}
    <h1 className={titleClassName}>{title}</h1>
    {description && <p className={descriptionClassName}>{description}</p>}
    {actions && <div className={`flex flex-wrap items-center gap-3 ${actionsClassName}`}>{actions}</div>}
  </section>;
}
