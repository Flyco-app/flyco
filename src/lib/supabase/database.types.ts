export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      booking_command_receipts: {
        Row: {
          actor_id: string
          booking_id: string
          command_type: string
          created_at: string
          id: number
          idempotency_key: string
          resulting_status: string
          resulting_version: number
        }
        Insert: {
          actor_id: string
          booking_id: string
          command_type: string
          created_at?: string
          id?: never
          idempotency_key: string
          resulting_status: string
          resulting_version: number
        }
        Update: {
          actor_id?: string
          booking_id?: string
          command_type?: string
          created_at?: string
          id?: never
          idempotency_key?: string
          resulting_status?: string
          resulting_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_command_receipts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_command_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          metadata: Json
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: never
          metadata?: Json
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: never
          metadata?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          delivery_request_id: string
          expired_at: string | null
          expires_at: string
          id: string
          match_id: string
          proposed_at: string
          rejected_at: string | null
          reserved_capacity_grams: number
          sender_id: string
          status: string
          traveler_id: string
          trip_id: string
          updated_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivery_request_id: string
          expired_at?: string | null
          expires_at: string
          id?: string
          match_id: string
          proposed_at?: string
          rejected_at?: string | null
          reserved_capacity_grams: number
          sender_id: string
          status?: string
          traveler_id: string
          trip_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivery_request_id?: string
          expired_at?: string | null
          expires_at?: string
          id?: string
          match_id?: string
          proposed_at?: string
          rejected_at?: string | null
          reserved_capacity_grams?: number
          sender_id?: string
          status?: string
          traveler_id?: string
          trip_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_delivery_request_id_fkey"
            columns: ["delivery_request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_match_relationship_fk"
            columns: ["match_id", "trip_id", "delivery_request_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id", "trip_id", "delivery_request_id"]
          },
          {
            foreignKeyName: "bookings_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_reservations: {
        Row: {
          booking_id: string
          capacity_grams: number
          release_reason: string | null
          released_at: string | null
          reserved_at: string
          trip_id: string
        }
        Insert: {
          booking_id: string
          capacity_grams: number
          release_reason?: string | null
          released_at?: string | null
          reserved_at?: string
          trip_id: string
        }
        Update: {
          booking_id?: string
          capacity_grams?: number
          release_reason?: string | null
          released_at?: string | null
          reserved_at?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_reservation_booking_terms_fk"
            columns: ["booking_id", "trip_id", "capacity_grams"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "trip_id", "reserved_capacity_grams"]
          },
          {
            foreignKeyName: "capacity_reservations_trip_fk"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      declared_items: {
        Row: {
          category_code: string
          created_at: string
          declared_contents: string
          delivery_request_id: string
          description: string
          fragile: boolean
          handling_notes: string | null
          height_mm: number | null
          id: string
          length_mm: number | null
          quantity: number
          title: string
          updated_at: string
          weight_grams: number
          width_mm: number | null
        }
        Insert: {
          category_code: string
          created_at?: string
          declared_contents: string
          delivery_request_id: string
          description: string
          fragile?: boolean
          handling_notes?: string | null
          height_mm?: number | null
          id?: string
          length_mm?: number | null
          quantity?: number
          title: string
          updated_at?: string
          weight_grams: number
          width_mm?: number | null
        }
        Update: {
          category_code?: string
          created_at?: string
          declared_contents?: string
          delivery_request_id?: string
          description?: string
          fragile?: boolean
          handling_notes?: string | null
          height_mm?: number | null
          id?: string
          length_mm?: number | null
          quantity?: number
          title?: string
          updated_at?: string
          weight_grams?: number
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "declared_items_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "declared_items_delivery_request_id_fkey"
            columns: ["delivery_request_id"]
            isOneToOne: true
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_request_cancellations: {
        Row: {
          cancelled_by: string
          created_at: string
          delivery_request_id: string
          reason: string
        }
        Insert: {
          cancelled_by: string
          created_at?: string
          delivery_request_id: string
          reason: string
        }
        Update: {
          cancelled_by?: string
          created_at?: string
          delivery_request_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_request_cancellations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_request_cancellations_delivery_request_id_fkey"
            columns: ["delivery_request_id"]
            isOneToOne: true
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_request_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          created_at: string
          delivery_request_id: string
          event_type: string
          from_status: string | null
          id: number
          metadata: Json
          request_version: number
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_kind: string
          created_at?: string
          delivery_request_id: string
          event_type: string
          from_status?: string | null
          id?: never
          metadata?: Json
          request_version: number
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          delivery_request_id?: string
          event_type?: string
          from_status?: string | null
          id?: never
          metadata?: Json
          request_version?: number
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_request_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_request_events_delivery_request_id_fkey"
            columns: ["delivery_request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_requests: {
        Row: {
          cancelled_at: string | null
          created_at: string
          destination_location_id: string
          earliest_departure_at: string
          expired_at: string | null
          id: string
          latest_delivery_at: string
          origin_location_id: string
          owner_id: string
          published_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          destination_location_id: string
          earliest_departure_at: string
          expired_at?: string | null
          id?: string
          latest_delivery_at: string
          origin_location_id: string
          owner_id: string
          published_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          destination_location_id?: string
          earliest_departure_at?: string
          expired_at?: string | null
          id?: string
          latest_delivery_at?: string
          origin_location_id?: string
          owner_id?: string
          published_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_requests_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verification_events: {
        Row: {
          actor_kind: string
          created_at: string
          from_state: string | null
          id: number
          reason_code: string | null
          to_state: string
          verification_id: string
        }
        Insert: {
          actor_kind: string
          created_at?: string
          from_state?: string | null
          id?: never
          reason_code?: string | null
          to_state: string
          verification_id: string
        }
        Update: {
          actor_kind?: string
          created_at?: string
          from_state?: string | null
          id?: never
          reason_code?: string | null
          to_state?: string
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_events_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "identity_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          provider: string | null
          provider_reference: string | null
          reason_code: string | null
          reviewed_at: string | null
          revoked_at: string | null
          state: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          version: number
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          reason_code?: string | null
          reviewed_at?: string | null
          revoked_at?: string | null
          state?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          version?: number
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          reason_code?: string | null
          reviewed_at?: string | null
          revoked_at?: string | null
          state?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "identity_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          sort_order: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          sort_order?: number
        }
        Relationships: []
      }
      item_photos: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          item_id: string
          mime_type: string
          ready_at: string | null
          size_bytes: number
          status: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id: string
          mime_type: string
          ready_at?: string | null
          size_bytes: number
          status?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id?: string
          mime_type?: string
          ready_at?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_photos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "declared_items"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          administrative_region: string | null
          canonical_name: string
          city_name: string
          city_slug: string
          country_code: string
          country_name: string
          created_at: string
          id: string
          kind: string
          latitude: number
          longitude: number
          timezone: string
        }
        Insert: {
          active?: boolean
          administrative_region?: string | null
          canonical_name: string
          city_name: string
          city_slug: string
          country_code: string
          country_name: string
          created_at?: string
          id: string
          kind?: string
          latitude: number
          longitude: number
          timezone: string
        }
        Update: {
          active?: boolean
          administrative_region?: string | null
          canonical_name?: string
          city_name?: string
          city_slug?: string
          country_code?: string
          country_name?: string
          created_at?: string
          id?: string
          kind?: string
          latitude?: number
          longitude?: number
          timezone?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          active: boolean
          algorithm_version: string
          capacity_slack_grams: number
          created_at: string
          date_slack_minutes: number
          delivery_request_id: string
          id: string
          reason_codes: string[]
          recomputed_at: string
          request_version: number
          score: number
          trip_id: string
          trip_version: number
        }
        Insert: {
          active?: boolean
          algorithm_version: string
          capacity_slack_grams: number
          created_at?: string
          date_slack_minutes: number
          delivery_request_id: string
          id?: string
          reason_codes: string[]
          recomputed_at?: string
          request_version: number
          score: number
          trip_id: string
          trip_version: number
        }
        Update: {
          active?: boolean
          algorithm_version?: string
          capacity_slack_grams?: number
          created_at?: string
          date_slack_minutes?: number
          delivery_request_id?: string
          id?: string
          reason_codes?: string[]
          recomputed_at?: string
          request_version?: number
          score?: number
          trip_id?: string
          trip_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "matches_delivery_request_id_fkey"
            columns: ["delivery_request_id"]
            isOneToOne: false
            referencedRelation: "delivery_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          residence_location_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          residence_location_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          residence_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profiles_residence_location_id_fkey"
            columns: ["residence_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_trust: {
        Row: {
          cancellation_count: number
          completed_deliveries: number
          completed_sender_jobs: number
          completed_traveler_jobs: number
          dispute_count: number
          email_verified: boolean
          identity_verified: boolean
          phone_verified: boolean
          profile_id: string
          rating_sum: number
          review_count: number
          updated_at: string
        }
        Insert: {
          cancellation_count?: number
          completed_deliveries?: number
          completed_sender_jobs?: number
          completed_traveler_jobs?: number
          dispute_count?: number
          email_verified?: boolean
          identity_verified?: boolean
          phone_verified?: boolean
          profile_id: string
          rating_sum?: number
          review_count?: number
          updated_at?: string
        }
        Update: {
          cancellation_count?: number
          completed_deliveries?: number
          completed_sender_jobs?: number
          completed_traveler_jobs?: number
          dispute_count?: number
          email_verified?: boolean
          identity_verified?: boolean
          phone_verified?: boolean
          profile_id?: string
          rating_sum?: number
          review_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_trust_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          created_at: string
          display_name: string
          first_name: string | null
          id: string
          last_name: string | null
          locale: string
          phone_e164: string | null
          phone_verified_at: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          display_name: string
          first_name?: string | null
          id: string
          last_name?: string | null
          locale?: string
          phone_e164?: string | null
          phone_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          created_at?: string
          display_name?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          locale?: string
          phone_e164?: string | null
          phone_verified_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trip_cancellations: {
        Row: {
          cancelled_by: string
          created_at: string
          reason: string
          trip_id: string
        }
        Insert: {
          cancelled_by: string
          created_at?: string
          reason: string
          trip_id: string
        }
        Update: {
          cancelled_by?: string
          created_at?: string
          reason?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_cancellations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_cancellations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_categories: {
        Row: {
          category_code: string
          trip_id: string
        }
        Insert: {
          category_code: string
          trip_id: string
        }
        Update: {
          category_code?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_categories_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trip_categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          metadata: Json
          to_status: string
          trip_id: string
          trip_version: number
        }
        Insert: {
          actor_id?: string | null
          actor_kind: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: never
          metadata?: Json
          to_status: string
          trip_id: string
          trip_version: number
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: never
          metadata?: Json
          to_status?: string
          trip_id?: string
          trip_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          arrival_at: string
          cancelled_at: string | null
          capacity_grams: number
          completed_at: string | null
          created_at: string
          departure_at: string
          destination_location_id: string
          expired_at: string | null
          id: string
          origin_location_id: string
          owner_id: string
          published_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          arrival_at: string
          cancelled_at?: string | null
          capacity_grams: number
          completed_at?: string | null
          created_at?: string
          departure_at: string
          destination_location_id: string
          expired_at?: string | null
          id?: string
          origin_location_id: string
          owner_id: string
          published_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          arrival_at?: string
          cancelled_at?: string | null
          capacity_grams?: number
          completed_at?: string | null
          created_at?: string
          departure_at?: string
          destination_location_id?: string
          expired_at?: string | null
          id?: string
          origin_location_id?: string
          owner_id?: string
          published_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "trips_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_booking: {
        Args: {
          input_booking_id: string
          input_expected_version: number
          input_idempotency_key: string
        }
        Returns: {
          booking_id: string
          status: string
          version: number
        }[]
      }
      begin_item_photo_upload: {
        Args: {
          input_expected_version: number
          input_mime_type: string
          input_request_id: string
          input_size_bytes: number
        }
        Returns: {
          photo_id: string
          request_version: number
          storage_path: string
        }[]
      }
      cancel_booking: {
        Args: {
          input_booking_id: string
          input_expected_version: number
          input_idempotency_key: string
          input_reason: string
        }
        Returns: {
          booking_id: string
          status: string
          version: number
        }[]
      }
      cancel_delivery_request: {
        Args: {
          input_expected_version: number
          input_reason: string
          input_request_id: string
        }
        Returns: number
      }
      cancel_trip: {
        Args: {
          input_expected_version: number
          input_reason: string
          input_trip_id: string
        }
        Returns: number
      }
      consume_auth_rate_limit: {
        Args: { key_hash: string; operation: string }
        Returns: boolean
      }
      create_delivery_request_draft: {
        Args: {
          input_category_code: string
          input_declared_contents: string
          input_description: string
          input_destination: string
          input_earliest_departure: string
          input_fragile: boolean
          input_handling_notes: string
          input_height_mm: number
          input_latest_delivery: string
          input_length_mm: number
          input_origin: string
          input_quantity: number
          input_title: string
          input_weight_grams: number
          input_width_mm: number
        }
        Returns: string
      }
      create_trip_draft: {
        Args: {
          input_arrival: string
          input_capacity_grams: number
          input_category_codes: string[]
          input_departure: string
          input_destination: string
          input_origin: string
        }
        Returns: string
      }
      expire_booking: {
        Args: {
          input_booking_id: string
          input_expected_version: number
          input_idempotency_key: string
        }
        Returns: {
          booking_id: string
          status: string
          version: number
        }[]
      }
      expire_own_delivery_requests: { Args: never; Returns: number }
      expire_own_departed_trips: { Args: never; Returns: number }
      finalize_item_photo_upload: {
        Args: { input_expected_version: number; input_photo_id: string }
        Returns: number
      }
      get_booking: {
        Args: { input_booking_id: string }
        Returns: {
          accepted_at: string
          arrival_at: string
          available_capacity_grams: number
          booking_id: string
          cancelled_at: string
          category_code: string
          counterparty_display_name: string
          counterparty_id: string
          delivery_request_id: string
          departure_at: string
          destination_name: string
          expired_at: string
          expires_at: string
          item_title: string
          match_id: string
          offered_capacity_grams: number
          origin_name: string
          participant_role: string
          proposed_at: string
          rejected_at: string
          reserved_capacity_grams: number
          reserved_trip_capacity_grams: number
          status: string
          trip_id: string
          version: number
        }[]
      }
      get_delivery_request_matches: {
        Args: {
          input_limit?: number
          input_offset?: number
          input_request_id: string
        }
        Returns: {
          algorithm_version: string
          arrival_at: string
          capacity_slack_grams: number
          category_codes: string[]
          date_slack_minutes: number
          departure_at: string
          destination_location_id: string
          destination_name: string
          destination_timezone: string
          item_weight_grams: number
          match_id: string
          origin_location_id: string
          origin_name: string
          origin_timezone: string
          reason_codes: string[]
          score: number
          traveler_completed_jobs: number
          traveler_display_name: string
          traveler_email_verified: boolean
          traveler_id: string
          traveler_identity_verified: boolean
          traveler_phone_verified: boolean
          traveler_rating_sum: number
          traveler_review_count: number
          trip_capacity_grams: number
          trip_id: string
        }[]
      }
      get_my_bookings: {
        Args: { input_limit?: number; input_offset?: number }
        Returns: {
          accepted_at: string
          arrival_at: string
          available_capacity_grams: number
          booking_id: string
          cancelled_at: string
          category_code: string
          counterparty_display_name: string
          counterparty_id: string
          delivery_request_id: string
          departure_at: string
          destination_name: string
          expired_at: string
          expires_at: string
          item_title: string
          match_id: string
          offered_capacity_grams: number
          origin_name: string
          participant_role: string
          proposed_at: string
          rejected_at: string
          reserved_capacity_grams: number
          reserved_trip_capacity_grams: number
          status: string
          trip_id: string
          version: number
        }[]
      }
      get_public_delivery_request: {
        Args: { input_request_id: string }
        Returns: {
          category_code: string
          destination_location_id: string
          earliest_departure_at: string
          fragile: boolean
          height_mm: number
          id: string
          latest_delivery_at: string
          length_mm: number
          origin_location_id: string
          owner_id: string
          quantity: number
          status: string
          title: string
          weight_grams: number
          width_mm: number
        }[]
      }
      get_public_trip: {
        Args: { input_trip_id: string }
        Returns: {
          arrival_at: string
          capacity_grams: number
          category_codes: string[]
          departure_at: string
          destination_location_id: string
          id: string
          origin_location_id: string
          owner_id: string
          status: string
        }[]
      }
      get_trip_matches: {
        Args: {
          input_limit?: number
          input_offset?: number
          input_trip_id: string
        }
        Returns: {
          algorithm_version: string
          capacity_slack_grams: number
          category_code: string
          date_slack_minutes: number
          delivery_request_id: string
          destination_location_id: string
          destination_name: string
          destination_timezone: string
          earliest_departure_at: string
          item_title: string
          latest_delivery_at: string
          match_id: string
          origin_location_id: string
          origin_name: string
          origin_timezone: string
          reason_codes: string[]
          score: number
          sender_completed_jobs: number
          sender_display_name: string
          sender_email_verified: boolean
          sender_id: string
          sender_identity_verified: boolean
          sender_phone_verified: boolean
          sender_rating_sum: number
          sender_review_count: number
          trip_capacity_grams: number
          weight_grams: number
        }[]
      }
      propose_booking: {
        Args: { input_idempotency_key: string; input_match_id: string }
        Returns: {
          booking_id: string
          status: string
          version: number
        }[]
      }
      publish_delivery_request: {
        Args: { input_expected_version: number; input_request_id: string }
        Returns: number
      }
      publish_trip: {
        Args: { input_expected_version: number; input_trip_id: string }
        Returns: number
      }
      reject_booking: {
        Args: {
          input_booking_id: string
          input_expected_version: number
          input_idempotency_key: string
        }
        Returns: {
          booking_id: string
          status: string
          version: number
        }[]
      }
      remove_item_photo: {
        Args: { input_expected_version: number; input_photo_id: string }
        Returns: {
          request_version: number
          storage_path: string
        }[]
      }
      sync_own_auth_trust: { Args: never; Returns: undefined }
      update_delivery_request: {
        Args: {
          input_category_code: string
          input_declared_contents: string
          input_description: string
          input_destination: string
          input_earliest_departure: string
          input_expected_version: number
          input_fragile: boolean
          input_handling_notes: string
          input_height_mm: number
          input_latest_delivery: string
          input_length_mm: number
          input_origin: string
          input_quantity: number
          input_request_id: string
          input_title: string
          input_weight_grams: number
          input_width_mm: number
        }
        Returns: number
      }
      update_own_profile: {
        Args: {
          new_bio: string
          new_display_name: string
          new_first_name: string
          new_last_name: string
          new_locale: string
          new_phone_e164: string
          new_residence_location_id: string
        }
        Returns: undefined
      }
      update_trip: {
        Args: {
          input_arrival: string
          input_capacity_grams: number
          input_category_codes: string[]
          input_departure: string
          input_destination: string
          input_expected_version: number
          input_origin: string
          input_trip_id: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

