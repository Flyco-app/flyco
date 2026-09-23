import 'server-only';
import { requireActiveAccount } from '@/lib/auth/session';
import type { Locale } from '@/lib/auth/validation';
import {
  hasKnownMatchReasons,
  matchingAlgorithmVersion,
  matchOffset,
  type MatchingReasonCode,
} from '@/modules/matching/model';

export const matchPageSize = 12;

type TrustFields = {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  completedJobs: number;
  reviewCount: number;
  ratingSum: number;
};

type RawTripMatch = {
  match_id: string;
  delivery_request_id: string;
  sender_id: string;
  origin_location_id: string;
  origin_name: string;
  origin_timezone: string;
  destination_location_id: string;
  destination_name: string;
  destination_timezone: string;
  earliest_departure_at: string;
  latest_delivery_at: string;
  category_code: string;
  item_title: string;
  weight_grams: number;
  trip_capacity_grams: number;
  date_slack_minutes: number;
  capacity_slack_grams: number;
  score: number | string;
  reason_codes: string[];
  algorithm_version: string;
  sender_display_name: string;
  sender_email_verified: boolean;
  sender_phone_verified: boolean;
  sender_identity_verified: boolean;
  sender_completed_jobs: number;
  sender_review_count: number;
  sender_rating_sum: number;
};

type RawRequestMatch = {
  match_id: string;
  trip_id: string;
  traveler_id: string;
  origin_location_id: string;
  origin_name: string;
  origin_timezone: string;
  destination_location_id: string;
  destination_name: string;
  destination_timezone: string;
  departure_at: string;
  arrival_at: string;
  category_codes: string[];
  trip_capacity_grams: number;
  item_weight_grams: number;
  date_slack_minutes: number;
  capacity_slack_grams: number;
  score: number | string;
  reason_codes: string[];
  algorithm_version: string;
  traveler_display_name: string;
  traveler_email_verified: boolean;
  traveler_phone_verified: boolean;
  traveler_identity_verified: boolean;
  traveler_completed_jobs: number;
  traveler_review_count: number;
  traveler_rating_sum: number;
};

export type TripMatch = TrustFields & {
  matchId: string;
  deliveryRequestId: string;
  senderId: string;
  originLocationId: string;
  originName: string;
  originTimezone: string;
  destinationLocationId: string;
  destinationName: string;
  destinationTimezone: string;
  earliestDepartureAt: string;
  latestDeliveryAt: string;
  categoryCode: string;
  itemTitle: string;
  weightGrams: number;
  tripCapacityGrams: number;
  dateSlackMinutes: number;
  capacitySlackGrams: number;
  score: number;
  reasonCodes: MatchingReasonCode[];
  algorithmVersion: typeof matchingAlgorithmVersion;
  displayName: string;
};

export type RequestMatch = TrustFields & {
  matchId: string;
  tripId: string;
  travelerId: string;
  originLocationId: string;
  originName: string;
  originTimezone: string;
  destinationLocationId: string;
  destinationName: string;
  destinationTimezone: string;
  departureAt: string;
  arrivalAt: string;
  categoryCodes: string[];
  tripCapacityGrams: number;
  itemWeightGrams: number;
  dateSlackMinutes: number;
  capacitySlackGrams: number;
  score: number;
  reasonCodes: MatchingReasonCode[];
  algorithmVersion: typeof matchingAlgorithmVersion;
  displayName: string;
};

function assertProjection(
  algorithmVersion: string,
  reasonCodes: string[],
): asserts reasonCodes is MatchingReasonCode[] {
  if (
    algorithmVersion !== matchingAlgorithmVersion ||
    !hasKnownMatchReasons(reasonCodes)
  )
    throw new Error('Unsupported matching projection.');
}

export async function loadTripMatches(
  locale: Locale,
  tripId: string,
  page: number,
): Promise<TripMatch[]> {
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('get_trip_matches', {
    input_trip_id: tripId,
    input_limit: matchPageSize,
    input_offset: matchOffset(page, matchPageSize),
  });
  if (result.error) throw new Error('Unable to load trip matches.');
  return (result.data as RawTripMatch[]).map((row) => {
    assertProjection(row.algorithm_version, row.reason_codes);
    return {
      matchId: row.match_id,
      deliveryRequestId: row.delivery_request_id,
      senderId: row.sender_id,
      originLocationId: row.origin_location_id,
      originName: row.origin_name,
      originTimezone: row.origin_timezone,
      destinationLocationId: row.destination_location_id,
      destinationName: row.destination_name,
      destinationTimezone: row.destination_timezone,
      earliestDepartureAt: row.earliest_departure_at,
      latestDeliveryAt: row.latest_delivery_at,
      categoryCode: row.category_code,
      itemTitle: row.item_title,
      weightGrams: row.weight_grams,
      tripCapacityGrams: row.trip_capacity_grams,
      dateSlackMinutes: row.date_slack_minutes,
      capacitySlackGrams: row.capacity_slack_grams,
      score: Number(row.score),
      reasonCodes: row.reason_codes,
      algorithmVersion: matchingAlgorithmVersion,
      displayName: row.sender_display_name,
      emailVerified: row.sender_email_verified,
      phoneVerified: row.sender_phone_verified,
      identityVerified: row.sender_identity_verified,
      completedJobs: row.sender_completed_jobs,
      reviewCount: row.sender_review_count,
      ratingSum: row.sender_rating_sum,
    };
  });
}

export async function loadDeliveryRequestMatches(
  locale: Locale,
  requestId: string,
  page: number,
): Promise<RequestMatch[]> {
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('get_delivery_request_matches', {
    input_request_id: requestId,
    input_limit: matchPageSize,
    input_offset: matchOffset(page, matchPageSize),
  });
  if (result.error) throw new Error('Unable to load delivery request matches.');
  return (result.data as RawRequestMatch[]).map((row) => {
    assertProjection(row.algorithm_version, row.reason_codes);
    return {
      matchId: row.match_id,
      tripId: row.trip_id,
      travelerId: row.traveler_id,
      originLocationId: row.origin_location_id,
      originName: row.origin_name,
      originTimezone: row.origin_timezone,
      destinationLocationId: row.destination_location_id,
      destinationName: row.destination_name,
      destinationTimezone: row.destination_timezone,
      departureAt: row.departure_at,
      arrivalAt: row.arrival_at,
      categoryCodes: row.category_codes,
      tripCapacityGrams: row.trip_capacity_grams,
      itemWeightGrams: row.item_weight_grams,
      dateSlackMinutes: row.date_slack_minutes,
      capacitySlackGrams: row.capacity_slack_grams,
      score: Number(row.score),
      reasonCodes: row.reason_codes,
      algorithmVersion: matchingAlgorithmVersion,
      displayName: row.traveler_display_name,
      emailVerified: row.traveler_email_verified,
      phoneVerified: row.traveler_phone_verified,
      identityVerified: row.traveler_identity_verified,
      completedJobs: row.traveler_completed_jobs,
      reviewCount: row.traveler_review_count,
      ratingSum: row.traveler_rating_sum,
    };
  });
}
