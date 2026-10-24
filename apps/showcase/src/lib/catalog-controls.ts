export function compareKnown(
  left: string | number | null,
  right: string | number | null,
  direction: string
) {
  const missing = (value: typeof left) =>
    value === null || value === '' || (typeof value === 'number' && !Number.isFinite(value));
  if (missing(left)) return missing(right) ? 0 : 1;
  if (missing(right)) return -1;
  const comparison =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right));
  return direction === 'desc' ? -comparison : comparison;
}

// Imported deadlines may be ranges. Sort by their first recorded date; do not
// turn a missing/rolling deadline into a date or infer current availability.
export function recordedDate(value: string | undefined): string | null {
  const date = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return date && Number.isFinite(Date.parse(date)) ? date : null;
}

export function catalogCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let text = String(value ?? '');
          // A downloaded source name/URL must not become a spreadsheet formula.
          if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
          return `"${text.replaceAll('"', '""')}"`;
        })
        .join(',')
    )
    .join('\r\n');
}

type Control = HTMLInputElement | HTMLSelectElement;

export function bindCatalogControls(
  form: HTMLFormElement,
  render: () => void,
  exportRows: () => (string | number | null | undefined)[][],
  filename: string
) {
  // Worker ambient Element types overlap DOM types in this workspace. These
  // selectors are restricted to browser form controls.
  const controls = Array.from(form.querySelectorAll('input[name], select[name]')) as Control[];
  const defaults = new Map(
    controls.map((control) => [
      control.name,
      control instanceof HTMLInputElement && control.type === 'checkbox'
        ? control.checked
          ? '1'
          : ''
        : control.value,
    ])
  );
  const status = form.querySelector<HTMLElement>('[data-catalog-status]');
  const download = form.querySelector<HTMLButtonElement>('[data-catalog-export]');
  let actionVersion = 0;

  function restore() {
    const params = new URL(location.href).searchParams;
    for (const control of controls) {
      const fallback = defaults.get(control.name) ?? '';
      const value = params.get(control.name) ?? fallback;
      if (control instanceof HTMLInputElement && control.type === 'checkbox') {
        control.checked = value === '1';
      } else if (control instanceof HTMLSelectElement) {
        control.value = Array.from(control.options).some((option) => option.value === value)
          ? value
          : fallback;
      } else {
        control.value = value;
        if (!control.validity.valid) control.value = fallback;
      }
    }
  }

  function update(save = true) {
    actionVersion += 1;
    for (const control of controls) {
      if (
        control instanceof HTMLInputElement &&
        control.type === 'number' &&
        !control.validity.valid
      ) {
        const number = Math.round(control.valueAsNumber);
        control.value = Number.isFinite(number)
          ? String(
              Math.min(
                Number(control.max || Infinity),
                Math.max(Number(control.min || -Infinity), number)
              )
            )
          : (defaults.get(control.name) ?? '');
      }
    }
    render();
    if (download) download.disabled = exportRows().length <= 1;
    if (status) status.textContent = '';
    if (!save) return;
    const url = new URL(location.href);
    for (const control of controls) {
      const value =
        control instanceof HTMLInputElement && control.type === 'checkbox'
          ? control.checked
            ? '1'
            : ''
          : control.value;
      if (value === defaults.get(control.name)) url.searchParams.delete(control.name);
      else url.searchParams.set(control.name, value);
    }
    if (url.href !== location.href) history.replaceState(null, '', url);
  }

  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', () => update());
  form.addEventListener('change', () => update());
  form.addEventListener('reset', () => requestAnimationFrame(() => update()));
  window.addEventListener('popstate', () => {
    restore();
    update(false);
  });
  form.querySelector('[data-catalog-copy]')?.addEventListener('click', async () => {
    update();
    const version = actionVersion;
    try {
      await navigator.clipboard.writeText(location.href);
      if (status && version === actionVersion)
        status.textContent = 'Link copied, including these filters and sort order.';
    } catch {
      if (status && version === actionVersion)
        status.textContent =
          'Copy the link from your address bar; it includes these filters and sort order.';
    }
  });
  download?.addEventListener('click', () => {
    actionVersion += 1;
    const rows = exportRows();
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', catalogCsv(rows)], { type: 'text/csv;charset=utf-8' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (status) status.textContent = `Exported ${rows.length - 1} results in the displayed order.`;
  });
  restore();
  update(false);
  return update;
}
