import { FormSection } from '@/components/ui/patterns';
import { uiCopy } from '@/lib/ui/copy';
import { SubmitButton } from '@/components/ui/submit-button';
import type { Locale } from '@/lib/auth/validation';
import { categoryLabel, tripCopy } from './copy';

type ReferenceData = {
  locations: {
    id: string;
    canonical_name: string;
    country_code: string;
    timezone: string;
  }[];
  categories: { code: string; sort_order: number }[];
};

type Defaults = {
  tripId: string;
  version: number;
  originLocationId: string;
  destinationLocationId: string;
  departureLocal: string;
  arrivalLocal: string;
  capacityKg: string;
  categoryCodes: string[];
  lockRoute: boolean;
};

export function TripForm({
  locale,
  references,
  action,
  defaults,
}: {
  locale: Locale;
  references: ReferenceData;
  action: (form: FormData) => Promise<void>;
  defaults?: Defaults;
}) {
  const d = tripCopy[locale];
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      {defaults && (
        <>
          <input type="hidden" name="tripId" value={defaults.tripId} />
          <input
            type="hidden"
            name="expectedVersion"
            value={defaults.version}
          />
        </>
      )}
      <FormSection
        step={1}
        title={uiCopy[locale].route}
        hint={uiCopy[locale].routeHint}
      >
        <label>
          {d.origin}
          <select
            className="field"
            name="originLocationId"
            required
            defaultValue={defaults?.originLocationId ?? ''}
            disabled={defaults?.lockRoute}
          >
            <option value="" disabled />
            {references.locations.map((location) => (
              <option value={location.id} key={location.id}>
                {location.canonical_name}
              </option>
            ))}
          </select>
        </label>
        {defaults?.lockRoute && (
          <input
            type="hidden"
            name="originLocationId"
            value={defaults.originLocationId}
          />
        )}
        <label>
          {d.destination}
          <select
            className="field"
            name="destinationLocationId"
            required
            defaultValue={defaults?.destinationLocationId ?? ''}
            disabled={defaults?.lockRoute}
          >
            <option value="" disabled />
            {references.locations.map((location) => (
              <option value={location.id} key={location.id}>
                {location.canonical_name}
              </option>
            ))}
          </select>
        </label>
        {defaults?.lockRoute && (
          <input
            type="hidden"
            name="destinationLocationId"
            value={defaults.destinationLocationId}
          />
        )}
      </FormSection>
      <FormSection
        step={2}
        title={uiCopy[locale].dates}
        hint={uiCopy[locale].datesHint}
      >
        <label>
          {d.departure}
          <input
            className="field"
            name="departureLocal"
            type="datetime-local"
            required
            defaultValue={defaults?.departureLocal}
          />
        </label>
        <label>
          {d.arrival}
          <input
            className="field"
            name="arrivalLocal"
            type="datetime-local"
            required
            defaultValue={defaults?.arrivalLocal}
          />
        </label>
        <p className="text-sm text-muted-foreground">{d.timezoneHint}</p>
      </FormSection>
      <FormSection
        step={3}
        title={uiCopy[locale].space}
        hint={uiCopy[locale].spaceHint}
      >
        <label>
          {d.capacity}
          <input
            className="field"
            name="capacityKg"
            type="number"
            inputMode="decimal"
            min="0.001"
            max="50"
            step="0.001"
            required
            defaultValue={defaults?.capacityKg ?? '5'}
          />
        </label>
        <fieldset className="grid gap-2 rounded-xl border p-4">
          <legend className="px-1 font-medium">{d.categories}</legend>
          {references.categories.map((category) => (
            <label className="flex items-center gap-2" key={category.code}>
              <input
                name="categoryCodes"
                type="checkbox"
                value={category.code}
                defaultChecked={defaults?.categoryCodes.includes(category.code)}
              />
              {categoryLabel(locale, category.code)}
            </label>
          ))}
        </fieldset>
      </FormSection>
      <SubmitButton locale={locale} className="button" type="submit">
        {defaults ? d.saveChanges : d.saveDraft}
      </SubmitButton>
    </form>
  );
}
