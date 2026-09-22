import type { Locale } from '@/lib/auth/validation';
import { requestCategoryLabel, requestCopy } from './copy';

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
  requestId: string;
  version: number;
  originLocationId: string;
  destinationLocationId: string;
  earliestDepartureLocal: string;
  latestDeliveryLocal: string;
  categoryCode: string;
  title: string;
  description: string;
  declaredContents: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  quantity: number;
  fragile: boolean;
  handlingNotes: string;
  lockRoute: boolean;
};

export function DeliveryRequestForm({
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
  const d = requestCopy[locale];
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      {defaults && (
        <>
          <input type="hidden" name="requestId" value={defaults.requestId} />
          <input
            type="hidden"
            name="expectedVersion"
            value={defaults.version}
          />
        </>
      )}
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
      <label>
        {d.earliestDeparture}
        <input
          className="field"
          name="earliestDepartureLocal"
          type="datetime-local"
          required
          defaultValue={defaults?.earliestDepartureLocal}
        />
      </label>
      <label>
        {d.latestDelivery}
        <input
          className="field"
          name="latestDeliveryLocal"
          type="datetime-local"
          required
          defaultValue={defaults?.latestDeliveryLocal}
        />
      </label>
      <p className="text-sm text-muted-foreground">{d.timezoneHint}</p>
      <fieldset className="grid gap-4 rounded-xl border p-4">
        <legend className="px-1 font-medium">{d.requestDetail}</legend>
        <label>
          {d.category}
          <select
            className="field"
            name="categoryCode"
            required
            defaultValue={defaults?.categoryCode ?? ''}
          >
            <option value="" disabled />
            {references.categories.map((category) => (
              <option value={category.code} key={category.code}>
                {requestCategoryLabel(locale, category.code)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {d.title}
          <input
            className="field"
            name="title"
            required
            minLength={3}
            maxLength={120}
            defaultValue={defaults?.title}
          />
        </label>
        <label>
          {d.description}
          <textarea
            className="field min-h-28"
            name="description"
            required
            minLength={20}
            maxLength={2000}
            defaultValue={defaults?.description}
          />
        </label>
        <label>
          {d.declaredContents}
          <textarea
            className="field min-h-24"
            name="declaredContents"
            required
            minLength={10}
            maxLength={1000}
            defaultValue={defaults?.declaredContents}
          />
        </label>
        <label>
          {d.weight}
          <input
            className="field"
            name="weightKg"
            type="number"
            inputMode="decimal"
            min="0.001"
            max="50"
            step="0.001"
            required
            defaultValue={defaults?.weightKg ?? '1'}
          />
        </label>
        <fieldset className="grid grid-cols-3 gap-3">
          <legend className="col-span-3 text-sm font-medium">
            {d.dimensions}
          </legend>
          <label>
            {d.length}
            <input
              className="field"
              name="lengthCm"
              type="number"
              inputMode="decimal"
              min="0.1"
              max="200"
              step="0.1"
              defaultValue={defaults?.lengthCm}
            />
          </label>
          <label>
            {d.width}
            <input
              className="field"
              name="widthCm"
              type="number"
              inputMode="decimal"
              min="0.1"
              max="200"
              step="0.1"
              defaultValue={defaults?.widthCm}
            />
          </label>
          <label>
            {d.height}
            <input
              className="field"
              name="heightCm"
              type="number"
              inputMode="decimal"
              min="0.1"
              max="200"
              step="0.1"
              defaultValue={defaults?.heightCm}
            />
          </label>
        </fieldset>
        <label>
          {d.quantity}
          <input
            className="field"
            name="quantity"
            type="number"
            min="1"
            max="100"
            step="1"
            required
            defaultValue={defaults?.quantity ?? 1}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            name="fragile"
            type="checkbox"
            defaultChecked={defaults?.fragile}
          />
          {d.fragile}
        </label>
        <label>
          {d.handlingNotes}
          <textarea
            className="field"
            name="handlingNotes"
            maxLength={1000}
            defaultValue={defaults?.handlingNotes}
          />
        </label>
      </fieldset>
      <button className="button" type="submit">
        {defaults ? d.saveChanges : d.saveDraft}
      </button>
    </form>
  );
}
