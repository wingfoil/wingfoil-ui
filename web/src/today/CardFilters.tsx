/**
 * The filters of a Today card (task-061, N2, N3; ux-reference §4.1 v0.3; D61-5): a type and a state
 * `Select` (React Aria, adr-002; built as the header's role view selector), each listing *All* and
 * the values of the card's rows with their counts (`facetsOf`, D61-4). The card owns the choice.
 */
import type { TodayRow } from '@wingfoil-ui/contracts';
import type { ReactNode } from 'react';
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import { FormattedMessage, useIntl } from 'react-intl';
import { Chevron } from '../shell/icons.js';
import { facetsOf, type CardFilter, type FacetKey } from './model.js';

/** The key of *All*; a value's key is prefixed, so no value can equal it. */
const ALL = 'all';
const keyOf = (value: string): string => `v:${value}`;

/** Props of {@link CardFilters}. */
export interface CardFiltersProps {
  /** The card's rows, unfiltered. */
  rows: readonly TodayRow[];
  /** The current choice (a value no row has was already dropped, `effectiveFilter`). */
  filter: CardFilter;
  onChange(filter: CardFilter): void;
}

/** One filter of the card. */
function FacetSelect({
  rows,
  facet,
  value,
  onChange,
}: {
  rows: readonly TodayRow[];
  facet: FacetKey;
  value: string | undefined;
  onChange(value: string | undefined): void;
}): ReactNode {
  const intl = useIntl();
  const items = [
    { id: ALL, text: intl.formatMessage({ id: 'today.filter.all' }, { count: rows.length }) },
    ...facetsOf(rows, facet).map((f) => ({
      id: keyOf(f.value),
      text: intl.formatMessage({ id: 'today.filter.option' }, { value: f.value, count: f.count }),
    })),
  ];
  return (
    <Select
      className="today-filter"
      value={value === undefined ? ALL : keyOf(value)}
      onChange={(key) => {
        const k = String(key);
        onChange(k === ALL ? undefined : k.slice(keyOf('').length));
      }}
    >
      <Label className="today-filter-label">
        {facet === 'type' ? <FormattedMessage id="today.filter.type" /> : <FormattedMessage id="today.filter.state" />}
      </Label>
      <Button className="button today-filter-button">
        <SelectValue />
        <Chevron />
      </Button>
      <Popover className="menu-popover today-filter-popover" placement="bottom start">
        <ListBox className="menu" items={items}>
          {(item) => (
            <ListBoxItem id={item.id} className="menu-item" textValue={item.text}>
              {item.text}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

/** The type and the state filter of a card. */
export function CardFilters({ rows, filter, onChange }: CardFiltersProps): ReactNode {
  const set = (facet: FacetKey, value: string | undefined): void => {
    const next: CardFilter = { ...filter };
    if (value === undefined) delete next[facet];
    else next[facet] = value;
    onChange(next);
  };
  return (
    <div className="today-filters">
      <FacetSelect rows={rows} facet="type" value={filter.type} onChange={(v) => set('type', v)} />
      <FacetSelect rows={rows} facet="state" value={filter.state} onChange={(v) => set('state', v)} />
    </div>
  );
}
