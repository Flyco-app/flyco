const localPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function parseLocal(value: string): LocalParts {
  const match = localPattern.exec(value);
  if (!match) throw new Error('Invalid local date and time.');
  const [, year, month, day, hour, minute] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour > 23 ||
    parts.minute > 59
  )
    throw new Error('Invalid local date and time.');
  const check = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() + 1 !== parts.month ||
    check.getUTCDate() !== parts.day
  )
    throw new Error('Invalid local date and time.');
  return parts;
}

function partsAt(instant: Date, timeZone: string): LocalParts {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return values as LocalParts;
}

function sameParts(left: LocalParts, right: LocalParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

function offsetAt(instantMs: number, timeZone: string): number {
  const instant = new Date(instantMs);
  const local = partsAt(instant, timeZone);
  return (
    Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) -
    Math.floor(instantMs / 60_000) * 60_000
  );
}

export function localDateTimeToUtc(value: string, timeZone: string): string {
  const target = parseLocal(value);
  const naive = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6)
    offsets.add(offsetAt(naive + hours * 3_600_000, timeZone));
  const candidates = [...offsets]
    .map((offset) => new Date(naive - offset))
    .filter((instant) => sameParts(partsAt(instant, timeZone), target));
  const unique = [...new Set(candidates.map((date) => date.toISOString()))];
  if (unique.length !== 1)
    throw new Error('Local time is missing or ambiguous in this timezone.');
  return unique[0]!;
}

export function utcToLocalDateTime(value: string, timeZone: string): string {
  const parts = partsAt(new Date(value), timeZone);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
