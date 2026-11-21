// The filters of the Modrinth layout's right sidebar, as Modrinth draws them
// (packages/ui/src/components/search/SearchSidebarFilter.vue and
// SearchFilterOption.vue): groups that fold, options as rows that light up.
// Used by Discover (MrBrowse.jsx) and by the shared Servers page.
import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Toggle } from '../components/ui.jsx';
import { IC } from './mrsize.js';

// a filter group in the sidebar (search/SearchSidebarFilter.vue): a header
// that folds it, showing what is chosen while folded
export function FilterSection({ title, children, summary = [], open: initial = true }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className={`mr-filter ${open ? 'open' : ''}`}>
      <button className="mr-filter-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="mr-filter-title">
          <h3>{title}</h3>
          <Icon name="dropdown" size={IC.s5} className="mr-chevron" />
        </span>
        {!open && summary.length ? (
          <span className="mr-filter-summary">
            {summary.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </span>
        ) : null}
      </button>
      <div className="mr-collapse" inert={open ? undefined : ''}>
        <div>
          <div className="mr-filter-body">{children}</div>
        </div>
      </div>
    </section>
  );
}

// one option (search/SearchFilterOption.vue): a row that lights up when
// chosen, with a check showing on hover
export function FilterOption({ on, onClick, children }) {
  return (
    <button className={`mr-filter-opt ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="mr-filter-opt-label">{children}</span>
      <Icon name="check" size={IC.s4} className="mr-filter-opt-check" />
    </button>
  );
}

// a switch at the top of the filters ("hide installed", "online only")
export function FilterSwitch({ label, checked, onChange }) {
  return (
    <section className="mr-side-section mr-filter-switch">
      <label className="mr-side-switch">
        <span>{label}</span>
        <span className="mr-toggle-sm">
          <Toggle checked={checked} onChange={onChange} />
        </span>
      </label>
    </section>
  );
}
