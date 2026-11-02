<?php
/**
 * One person across channels.
 *
 * A conversation stays on the channel it arrived on, so a reply still leaves
 * on WhatsApp, email, or live chat. Contacts tie those conversations together
 * when a trusted email or phone number is the same.
 *
 * Trusted matches:
 *   - Email address on the email channel, or a logged-in WordPress user
 *   - Phone number on WhatsApp, SMS, or the live chat phone field
 *
 * A typed live chat email is stored, and it does not merge anyone by itself.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Contacts {

	const BACKFILL_OPTION = 'kmbp_contacts_backfill_v1';

	/**
	 * Create contact tables and attach existing conversations once.
	 */
	public static function maybe_upgrade(): void {
		global $wpdb;

		$contacts = $wpdb->prefix . 'kmbp_contacts';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$ready = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $contacts ) ) === $contacts;
		if ( ! $ready ) {
			self::create_tables();
		}
		self::ensure_conversation_column();

		if ( get_option( self::BACKFILL_OPTION ) ) {
			return;
		}
		self::backfill();
		update_option( self::BACKFILL_OPTION, 1, false );
	}

	/**
	 * Digits only, 8 to 15 characters. Empty when the value is not a phone number.
	 */
	public static function normalize_phone( string $raw ): string {
		$digits = preg_replace( '/\D+/', '', $raw );
		if ( ! is_string( $digits ) ) {
			return '';
		}
		$len = strlen( $digits );
		if ( $len < 8 || $len > 15 ) {
			return '';
		}
		return $digits;
	}

	/**
	 * Keep a saved country code as a plus and 1 to 4 digits, or empty.
	 */
	public static function normalize_country_code( string $raw ): string {
		$digits = preg_replace( '/\D+/', '', $raw );
		if ( ! is_string( $digits ) || strlen( $digits ) < 1 || strlen( $digits ) > 4 ) {
			return '';
		}
		return '+' . $digits;
	}

	/**
	 * Add the site country code when the visitor typed a national number.
	 * A number that already starts with that code is left as-is.
	 */
	public static function with_country_code( string $raw, string $country_code ): string {
		$code   = preg_replace( '/\D+/', '', self::normalize_country_code( $country_code ) );
		$digits = preg_replace( '/\D+/', '', $raw );
		if ( ! is_string( $digits ) ) {
			return '';
		}
		if ( is_string( $code ) && '' !== $code && 0 !== strpos( $digits, $code ) ) {
			$digits = $code . ltrim( $digits, '0' );
		}
		return self::normalize_phone( $digits );
	}

	/**
	 * Attach a conversation to the person it belongs to.
	 *
	 * @param array $signals email, phone, email_trusted, phone_trusted, wp_user_id.
	 */
	public static function link( int $conversation_id, string $channel, string $platform_id, string $name, string $handle, array $signals = array() ): void {
		global $wpdb;

		if ( $conversation_id <= 0 ) {
			return;
		}

		$channel     = sanitize_key( $channel );
		$platform_id = substr( sanitize_text_field( $platform_id ), 0, 191 );
		if ( '' === $channel || '' === $platform_id ) {
			return;
		}

		$email         = sanitize_email( (string) ( $signals['email'] ?? '' ) );
		$email         = is_email( $email ) ? strtolower( $email ) : '';
		$phone         = self::normalize_phone( (string) ( $signals['phone'] ?? '' ) );
		$email_trusted = ! empty( $signals['email_trusted'] ) && '' !== $email;
		$phone_trusted = ! empty( $signals['phone_trusted'] ) && '' !== $phone;
		$wp_user_id    = absint( $signals['wp_user_id'] ?? 0 );
		$name          = sanitize_text_field( $name );
		$handle        = sanitize_text_field( $handle );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$identity = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}kmbp_contact_identities WHERE channel = %s AND external_id = %s LIMIT 1",
				$channel,
				$platform_id
			),
			ARRAY_A
		);

		$candidates = array();
		if ( $identity ) {
			$candidates[] = (int) $identity['contact_id'];
		}
		if ( $email_trusted ) {
			$candidates[] = (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM {$wpdb->prefix}kmbp_contacts WHERE email = %s LIMIT 1", $email )
			);
		}
		if ( $phone_trusted ) {
			$candidates[] = (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM {$wpdb->prefix}kmbp_contacts WHERE phone = %s LIMIT 1", $phone )
			);
		}
		if ( $wp_user_id > 0 ) {
			$candidates[] = (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM {$wpdb->prefix}kmbp_contacts WHERE wp_user_id = %d LIMIT 1", $wp_user_id )
			);
		}

		$candidates = array_values( array_unique( array_filter( $candidates ) ) );
		$contact_id = self::choose_contact( $candidates );

		if ( $contact_id <= 0 ) {
			$wpdb->insert(
				$wpdb->prefix . 'kmbp_contacts',
				array(
					'display_name' => $name,
					'email'        => $email_trusted ? $email : '',
					'phone'        => $phone_trusted ? $phone : '',
					'wp_user_id'   => $wp_user_id > 0 ? $wp_user_id : null,
					'created_at'   => current_time( 'mysql' ),
					'updated_at'   => current_time( 'mysql' ),
				),
				array( '%s', '%s', '%s', '%d', '%s', '%s' )
			);
			$contact_id = (int) $wpdb->insert_id;
		} else {
			foreach ( $candidates as $other_id ) {
				if ( $other_id !== $contact_id ) {
					self::reassign( $other_id, $contact_id );
				}
			}
			if ( $phone_trusted ) {
				$phone_owner = (int) $wpdb->get_var(
					$wpdb->prepare( "SELECT id FROM {$wpdb->prefix}kmbp_contacts WHERE phone = %s AND id != %d LIMIT 1", $phone, $contact_id )
				);
				if ( $phone_owner > 0 ) {
					$phone_trusted = false;
				}
			}
			if ( $email_trusted ) {
				$email_owner = (int) $wpdb->get_var(
					$wpdb->prepare( "SELECT id FROM {$wpdb->prefix}kmbp_contacts WHERE email = %s AND id != %d LIMIT 1", $email, $contact_id )
				);
				if ( $email_owner > 0 ) {
					$email_trusted = false;
				}
			}
			self::fill_contact( $contact_id, $name, $email, $phone, $wp_user_id, $email_trusted, $phone_trusted );
		}

		if ( $contact_id <= 0 ) {
			return;
		}

		$identity_data = array(
			'contact_id'    => $contact_id,
			'handle'        => substr( $handle, 0, 191 ),
			'email'         => $email,
			'phone'         => $phone,
			'email_trusted' => $email_trusted ? 1 : 0,
			'phone_trusted' => $phone_trusted ? 1 : 0,
		);
		if ( $identity ) {
			$wpdb->update(
				$wpdb->prefix . 'kmbp_contact_identities',
				$identity_data,
				array( 'id' => (int) $identity['id'] ),
				array( '%d', '%s', '%s', '%s', '%d', '%d' ),
				array( '%d' )
			);
		} else {
			$identity_data['channel']     = $channel;
			$identity_data['external_id'] = $platform_id;
			$identity_data['created_at']  = current_time( 'mysql' );
			$wpdb->insert(
				$wpdb->prefix . 'kmbp_contact_identities',
				$identity_data,
				array( '%d', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%s' )
			);
		}

		$wpdb->update(
			$wpdb->prefix . 'kmbp_conversations',
			array( 'contact_id' => $contact_id ),
			array( 'id' => $conversation_id ),
			array( '%d' ),
			array( '%d' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	/**
	 * Keep the oldest contact that does not disagree on email, phone, or user.
	 *
	 * @param int[] $candidate_ids
	 */
	private static function choose_contact( array $candidate_ids ): int {
		global $wpdb;
		if ( empty( $candidate_ids ) ) {
			return 0;
		}
		sort( $candidate_ids );
		$keeper = 0;
		$kept   = null;
		foreach ( $candidate_ids as $id ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}kmbp_contacts WHERE id = %d", $id ), ARRAY_A );
			if ( ! $row ) {
				continue;
			}
			if ( null === $kept ) {
				$keeper = (int) $row['id'];
				$kept   = $row;
				continue;
			}
			if ( ! self::conflicts( $kept, $row ) ) {
				continue;
			}
			// A later candidate disagrees. Ignore it rather than combining two people.
		}
		return $keeper;
	}

	/**
	 * @param array $a Contact row.
	 * @param array $b Contact row.
	 */
	private static function conflicts( array $a, array $b ): bool {
		if ( '' !== (string) $a['email'] && '' !== (string) $b['email'] && strtolower( (string) $a['email'] ) !== strtolower( (string) $b['email'] ) ) {
			return true;
		}
		if ( '' !== (string) $a['phone'] && '' !== (string) $b['phone'] && (string) $a['phone'] !== (string) $b['phone'] ) {
			return true;
		}
		if ( (int) $a['wp_user_id'] > 0 && (int) $b['wp_user_id'] > 0 && (int) $a['wp_user_id'] !== (int) $b['wp_user_id'] ) {
			return true;
		}
		return false;
	}

	/**
	 * Move every conversation and identity from one contact onto another.
	 */
	private static function reassign( int $from_id, int $to_id ): void {
		global $wpdb;
		if ( $from_id <= 0 || $to_id <= 0 || $from_id === $to_id ) {
			return;
		}
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$from = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}kmbp_contacts WHERE id = %d", $from_id ), ARRAY_A );
		$to   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}kmbp_contacts WHERE id = %d", $to_id ), ARRAY_A );
		if ( ! $from || ! $to || self::conflicts( $from, $to ) ) {
			return;
		}

		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}kmbp_conversations SET contact_id = %d WHERE contact_id = %d", $to_id, $from_id ) );
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}kmbp_contact_identities SET contact_id = %d WHERE contact_id = %d", $to_id, $from_id ) );
		self::fill_contact(
			$to_id,
			(string) $from['display_name'],
			(string) $from['email'],
			(string) $from['phone'],
			(int) $from['wp_user_id'],
			'' !== (string) $from['email'],
			'' !== (string) $from['phone']
		);
		$wpdb->delete( $wpdb->prefix . 'kmbp_contacts', array( 'id' => $from_id ), array( '%d' ) );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	private static function fill_contact( int $contact_id, string $name, string $email, string $phone, int $wp_user_id, bool $email_trusted, bool $phone_trusted ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}kmbp_contacts WHERE id = %d", $contact_id ), ARRAY_A );
		if ( ! $row ) {
			return;
		}

		$data   = array( 'updated_at' => current_time( 'mysql' ) );
		$format = array( '%s' );
		if ( '' !== $name && ( '' === (string) $row['display_name'] || (string) $row['display_name'] === (string) $row['email'] ) ) {
			$data['display_name'] = $name;
			$format[]             = '%s';
		}
		if ( $email_trusted && '' === (string) $row['email'] ) {
			$data['email'] = $email;
			$format[]      = '%s';
		}
		if ( $phone_trusted && '' === (string) $row['phone'] ) {
			$data['phone'] = $phone;
			$format[]      = '%s';
		}
		if ( $wp_user_id > 0 && (int) $row['wp_user_id'] <= 0 ) {
			$data['wp_user_id'] = $wp_user_id;
			$format[]           = '%d';
		}
		if ( count( $data ) === 1 ) {
			return;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->update( $wpdb->prefix . 'kmbp_contacts', $data, array( 'id' => $contact_id ), $format, array( '%d' ) );
	}

	private static function create_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$prefix  = $wpdb->prefix;

		dbDelta(
			"CREATE TABLE {$prefix}kmbp_contacts (
				id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				display_name VARCHAR(191) NOT NULL DEFAULT '',
				email VARCHAR(191) NOT NULL DEFAULT '',
				phone VARCHAR(20) NOT NULL DEFAULT '',
				wp_user_id BIGINT(20) UNSIGNED NULL,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				KEY email (email),
				KEY phone (phone),
				KEY wp_user_id (wp_user_id)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$prefix}kmbp_contact_identities (
				id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				contact_id BIGINT(20) UNSIGNED NOT NULL,
				channel VARCHAR(40) NOT NULL,
				external_id VARCHAR(191) NOT NULL,
				handle VARCHAR(191) NOT NULL DEFAULT '',
				email VARCHAR(191) NOT NULL DEFAULT '',
				phone VARCHAR(20) NOT NULL DEFAULT '',
				email_trusted TINYINT(1) NOT NULL DEFAULT 0,
				phone_trusted TINYINT(1) NOT NULL DEFAULT 0,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				UNIQUE KEY channel_external (channel, external_id),
				KEY contact_id (contact_id),
				KEY email (email),
				KEY phone (phone)
			) {$charset};"
		);
	}

	private static function ensure_conversation_column(): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$col = $wpdb->get_results( $wpdb->prepare( "SHOW COLUMNS FROM {$wpdb->prefix}kmbp_conversations LIKE %s", 'contact_id' ) );
		if ( ! empty( $col ) ) {
			return;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( "ALTER TABLE {$wpdb->prefix}kmbp_conversations ADD COLUMN contact_id BIGINT(20) UNSIGNED NULL DEFAULT NULL AFTER external_id, ADD KEY contact_id (contact_id)" );
	}

	/**
	 * Give every existing conversation a contact, then fold exact email and phone matches.
	 */
	private static function backfill(): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results( "SELECT id, channel, external_id, contact_name, contact_handle FROM {$wpdb->prefix}kmbp_conversations WHERE contact_id IS NULL OR contact_id = 0", ARRAY_A );

		foreach ( (array) $rows as $row ) {
			$channel  = (string) $row['channel'];
			$external = (string) $row['external_id'];
			$handle   = (string) $row['contact_handle'];
			$signals  = array();
			$platform = $external;

			if ( in_array( $channel, array( 'whatsapp', 'sms' ), true ) ) {
				$phone = self::normalize_phone( $external );
				if ( '' !== $phone ) {
					$signals['phone']         = $phone;
					$signals['phone_trusted'] = true;
					$platform                 = $phone;
				}
			}
			if ( 'email' === $channel && is_email( $handle ) ) {
				$signals['email']         = $handle;
				$signals['email_trusted'] = true;
				$platform                 = strtolower( $handle );
			}
			if ( 'livechat' === $channel && preg_match( '/^kmbp-user-(\d+)$/', $external, $match ) ) {
				$user = get_userdata( (int) $match[1] );
				if ( $user instanceof WP_User && is_email( $user->user_email ) ) {
					$signals['wp_user_id']    = (int) $user->ID;
					$signals['email']         = $user->user_email;
					$signals['email_trusted'] = true;
				}
			}

			self::link( (int) $row['id'], $channel, $platform, (string) $row['contact_name'], $handle, $signals );
		}
	}
}
