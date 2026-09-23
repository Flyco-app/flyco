import type { SVGProps } from 'react';
export type IconName =
  | 'home'
  | 'parcel'
  | 'plane'
  | 'booking'
  | 'user'
  | 'arrow'
  | 'check'
  | 'shield'
  | 'globe';
const paths: Record<IconName, string> = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  parcel: 'm3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 5 9-5M12 12v9M7 5l10 5',
  plane: 'm22 2-7 20-4-9-9-4Zm0 0L11 13',
  booking: 'M5 4h14v17H5ZM9 4V2m6 2V2M8 10h8m-8 4h5m-5 4h3',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6',
  globe:
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
};
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
