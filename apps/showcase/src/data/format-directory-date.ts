const directoryDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDirectoryDate(date: string): string {
  return directoryDateFormatter.format(new Date(`${date}T00:00:00Z`));
}
