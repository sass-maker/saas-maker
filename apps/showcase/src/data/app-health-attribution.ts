export type AppHealthTrafficClass = 'qa' | 'internal' | 'unknown';

const fixedDestinations = new Set(['project_directory', 'feedback_docs']);

function declaredMarker(search: string, key: 'fleet_qa' | 'fleet_internal') {
  const values = new URLSearchParams(search).getAll(key);
  if (values.length === 0) return { present: false, valid: false };
  return { present: true, valid: values.length === 1 && values[0] === '1' };
}

export function appHealthEventProperties(
  search: string,
  destinationId: string | null,
  projectIds: readonly string[]
) {
  const qa = declaredMarker(search, 'fleet_qa');
  const internal = declaredMarker(search, 'fleet_internal');
  const ambiguous = (qa.present && !qa.valid) || (internal.present && !internal.valid);
  const trafficClass: AppHealthTrafficClass =
    ambiguous || qa.valid === internal.valid ? 'unknown' : qa.valid ? 'qa' : 'internal';
  const properties: Record<string, string> = { traffic_class: trafficClass };

  if (
    destinationId &&
    (fixedDestinations.has(destinationId) || projectIds.includes(destinationId))
  ) {
    properties.destination_id = destinationId;
  }
  return properties;
}
