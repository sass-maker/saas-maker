'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { DataTable, type DataColumn, type DataSort } from '@saas-maker/ui/components/data-table';
import styles from './scoreboard-workbench.module.css';

/** The shared table's sorting/paging, with page scrolling and labelled narrow rows. */
export function ScoreboardTable<T extends object>({
  data,
  columns,
  getRowId,
  label,
  onRowClick,
  selectedId,
  sort,
  onSortChange,
  className = '',
}: {
  data: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  label: string;
  onRowClick: (row: T) => void;
  selectedId?: string | null;
  sort?: DataSort;
  onSortChange?: (sort: DataSort) => void;
  className?: string;
}) {
  const [localSort, setLocalSort] = useState<DataSort>([]);
  const sorting = sort ?? localSort;
  const setSort = onSortChange ?? setLocalSort;
  const sortable = columns.filter((c) => c.sortable !== false);
  const current = sorting[0];
  const labelled = columns.map((c) => ({
    ...c,
    minWidth: undefined,
    cell: (row: T) => (
      <div className={styles.tableCell}>
        {c.group && <span className={styles.narrowCellGroup}>{c.group}</span>}
        <span className={styles.narrowCellLabel}>{c.header}</span>
        <div>{c.cell ? c.cell(row) : c.value(row)}</div>
      </div>
    ),
  }));
  return (
    <div className={`${styles.responsiveTable} ${className}`}>
      <DataTable
        data={data}
        columns={labelled}
        getRowId={getRowId}
        label={label}
        onRowClick={onRowClick}
        selectedId={selectedId}
        sort={sorting}
        onSortChange={(next) => {
          // Header clicks alternate directions. Resetting to recommended order
          // remains an explicit choice in the narrow-screen sort control.
          setSort(next.length || !current ? next : [{ ...current, desc: !current.desc }]);
        }}
        maxHeight="none"
        pageSize={20}
        toolbar={() => (
          <div className={styles.narrowSort}>
            <label>
              Sort by{' '}
              <select
                aria-label={`${label}: sort by`}
                value={current?.id ?? ''}
                onChange={(e) =>
                  setSort(e.target.value ? [{ id: e.target.value, desc: false }] : [])
                }
              >
                <option value="">Recommended order</option>
                {sortable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.group ? `${c.group} · ${c.header}` : c.header}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!current}
              aria-label={`${label}: reverse sort`}
              onClick={() => {
                if (current) setSort([{ ...current, desc: !current.desc }]);
              }}
            >
              {current?.desc ? <ArrowDown size={14} /> : <ArrowUp size={14} />}{' '}
              {current?.desc ? 'Descending' : 'Ascending'}
            </button>
          </div>
        )}
      />
    </div>
  );
}
