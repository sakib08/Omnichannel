<?php
/**
 * REST API surface for the React admin app.
 *
 *   Namespace : sme/v1
 *
 *   Settings
 *     GET  /settings                — return every platform setting
 *     GET  /settings/(?P<channel>)  — return one channel's settings
 *     POST /settings                — replace every channel's settings
 *     POST /settings/(?P<channel>)  — update one channel's settings
 *
 *   Departments
 *     GET    /departments
 *     POST   /departments
 *     PUT    /departments/(?P<id>\d+)
 *     DELETE /departments/(?P<id>\d+)
 *
 *   Agents
 *     GET  /agents                       — list users in sme_agent role
 *     POST /agents/(?P<id>\d+)/departments — assign departments to an agent
 *
 *   Messages / conversations
 *     GET  /conversations
 *     GET  /conversations/(?P<id>\d+)/messages
 *     POST /conversations            — create conversation
 *     POST /messages                 — append a message to a conversation
 *
 * @package Synchronized_Messaging_Engine
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Synchronized_Messaging_Engine_Rest_Api {

    const NAMESPACE_V1 = 'sme/v1';

    /** Channels supported by the React app — every key matches a wp_option sub-array. */
    public static function supported_channels() {
        return array( 'messenger', 'email', 'whatsapp', 'telegram', 'sms', 'line', 'viber', 'wechat', 'instagram' );
    }

    public function register_routes() {
        // ─── Settings ────────────────────────────────────────────────────────
        register_rest_route(
            self::NAMESPACE_V1,
            '/settings',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_all_settings' ),
                    'permission_callback' => array( $this, 'check_manage_settings' ),
                ),
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'save_all_settings' ),
                    'permission_callback' => array( $this, 'check_manage_settings' ),
                ),
            )
        );

        register_rest_route(
            self::NAMESPACE_V1,
            '/settings/(?P<channel>[a-z0-9_-]+)',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_channel_settings' ),
                    'permission_callback' => array( $this, 'check_manage_settings' ),
                ),
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'save_channel_settings' ),
                    'permission_callback' => array( $this, 'check_manage_settings' ),
                ),
            )
        );

        // ─── Departments ─────────────────────────────────────────────────────
        register_rest_route(
            self::NAMESPACE_V1,
            '/departments',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'list_departments' ),
                    'permission_callback' => array( $this, 'check_access_messaging' ),
                ),
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_department' ),
                    'permission_callback' => array( $this, 'check_manage_depts' ),
                ),
            )
        );

        register_rest_route(
            self::NAMESPACE_V1,
            '/departments/(?P<id>\d+)',
            array(
                array(
                    'methods'             => WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_department' ),
                    'permission_callback' => array( $this, 'check_manage_depts' ),
                ),
                array(
                    'methods'             => WP_REST_Server::DELETABLE,
                    'callback'            => array( $this, 'delete_department' ),
                    'permission_callback' => array( $this, 'check_manage_depts' ),
                ),
            )
        );

        // ─── Agents ──────────────────────────────────────────────────────────
        register_rest_route(
            self::NAMESPACE_V1,
            '/agents',
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( $this, 'list_agents' ),
                'permission_callback' => array( $this, 'check_access_messaging' ),
            )
        );

        register_rest_route(
            self::NAMESPACE_V1,
            '/agents/(?P<id>\d+)/departments',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'assign_agent_departments' ),
                'permission_callback' => array( $this, 'check_manage_depts' ),
            )
        );

        // ─── Conversations & messages ────────────────────────────────────────
        register_rest_route(
            self::NAMESPACE_V1,
            '/conversations',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'list_conversations' ),
                    'permission_callback' => array( $this, 'check_access_messaging' ),
                ),
                array(
                    'methods'             => WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_conversation' ),
                    'permission_callback' => array( $this, 'check_access_messaging' ),
                ),
            )
        );

        register_rest_route(
            self::NAMESPACE_V1,
            '/conversations/(?P<id>\d+)',
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'update_conversation' ),
                'permission_callback' => array( $this, 'check_access_messaging' ),
            )
        );

        register_rest_route(
            self::NAMESPACE_V1,
            '/conversations/(?P<id>\d+)/messages',
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( $this, 'list_messages' ),
                'permission_callback' => array( $this, 'check_access_messaging' ),
            )
        );

        register_rest_route(
            self::NAMESPACE_V1,
            '/messages',
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'create_message' ),
                'permission_callback' => array( $this, 'check_access_messaging' ),
            )
        );
    }

    // ─── Permission helpers ──────────────────────────────────────────────────
    public function check_manage_settings() {
        return current_user_can( Synchronized_Messaging_Engine_Activator::CAP_MANAGE_SETTINGS )
            || current_user_can( 'manage_options' );
    }

    public function check_manage_depts() {
        return current_user_can( Synchronized_Messaging_Engine_Activator::CAP_MANAGE_DEPTS )
            || current_user_can( 'manage_options' );
    }

    public function check_access_messaging() {
        return current_user_can( Synchronized_Messaging_Engine_Activator::CAP_ACCESS_MESSAGING )
            || current_user_can( 'manage_options' );
    }

    // ─── Settings handlers ───────────────────────────────────────────────────
    public function get_all_settings() {
        $settings = get_option( Synchronized_Messaging_Engine_Activator::SETTINGS_OPTION, array() );
        return rest_ensure_response( $this->normalize_settings_output( (array) $settings ) );
    }

    public function get_channel_settings( WP_REST_Request $request ) {
        $channel = $request->get_param( 'channel' );
        if ( ! in_array( $channel, self::supported_channels(), true ) ) {
            return new WP_Error( 'sme_unknown_channel', __( 'Unknown channel.', 'synchronized-messaging-engine' ), array( 'status' => 404 ) );
        }
        $settings = (array) get_option( Synchronized_Messaging_Engine_Activator::SETTINGS_OPTION, array() );
        $current  = isset( $settings[ $channel ] ) ? (array) $settings[ $channel ] : array();
        return rest_ensure_response( $this->scrub_secrets_for_output( $current ) );
    }

    public function save_all_settings( WP_REST_Request $request ) {
        $payload = $request->get_json_params();
        if ( ! is_array( $payload ) ) {
            return new WP_Error( 'sme_invalid_payload', __( 'Expected a JSON object.', 'synchronized-messaging-engine' ), array( 'status' => 400 ) );
        }

        $existing = (array) get_option( Synchronized_Messaging_Engine_Activator::SETTINGS_OPTION, array() );
        $allowed  = self::supported_channels();

        foreach ( $payload as $channel => $values ) {
            if ( ! in_array( $channel, $allowed, true ) || ! is_array( $values ) ) {
                continue;
            }
            $current             = isset( $existing[ $channel ] ) ? (array) $existing[ $channel ] : array();
            $existing[ $channel ] = $this->sanitize_channel_payload( array_merge( $current, $values ) );
        }
        update_option( Synchronized_Messaging_Engine_Activator::SETTINGS_OPTION, $existing, false );
        return rest_ensure_response( $this->normalize_settings_output( $existing ) );
    }

    public function save_channel_settings( WP_REST_Request $request ) {
        $channel = $request->get_param( 'channel' );
        if ( ! in_array( $channel, self::supported_channels(), true ) ) {
            return new WP_Error( 'sme_unknown_channel', __( 'Unknown channel.', 'synchronized-messaging-engine' ), array( 'status' => 404 ) );
        }
        $payload = $request->get_json_params();
        if ( ! is_array( $payload ) ) {
            return new WP_Error( 'sme_invalid_payload', __( 'Expected a JSON object.', 'synchronized-messaging-engine' ), array( 'status' => 400 ) );
        }

        $existing            = (array) get_option( Synchronized_Messaging_Engine_Activator::SETTINGS_OPTION, array() );
        $current             = isset( $existing[ $channel ] ) ? (array) $existing[ $channel ] : array();
        $existing[ $channel ] = $this->sanitize_channel_payload( array_merge( $current, $payload ) );
        update_option( Synchronized_Messaging_Engine_Activator::SETTINGS_OPTION, $existing, false );

        return rest_ensure_response( $this->scrub_secrets_for_output( $existing[ $channel ] ) );
    }

    private function sanitize_channel_payload( array $payload ) {
        $out = array();
        foreach ( $payload as $key => $value ) {
            // Preserve camelCase — only reject keys that aren't safe identifier characters.
            // sanitize_key() must NOT be used here because it lowercases everything,
            // which would mangle camelCase keys like "pageToken" → "pagetoken".
            $key = (string) $key;
            if ( ! preg_match( '/^[a-zA-Z_][a-zA-Z0-9_]*$/', $key ) ) {
                continue;
            }
            if ( is_bool( $value ) ) {
                $out[ $key ] = (bool) $value;
            } elseif ( is_array( $value ) ) {
                $out[ $key ] = array_map( 'sanitize_text_field', wp_unslash( $value ) );
            } elseif ( is_numeric( $value ) ) {
                $out[ $key ] = $value + 0;
            } else {
                $out[ $key ] = sanitize_textarea_field( (string) $value );
            }
        }
        return $out;
    }

    /**
     * Mask secret-looking keys when returning to the client so tokens aren't
     * casually leaked back to the browser; the value is still preserved in
     * the DB and overwritten on save only when the client sends a new value.
     */
    private function scrub_secrets_for_output( array $values ) {
        $secret_keys = array( 'accessToken', 'authToken', 'channelSecret', 'appSecret', 'smtpPass', 'imapPass', 'serverToken', 'encodingAesKey', 'pageToken', 'botToken' );
        foreach ( $values as $key => $value ) {
            if ( in_array( $key, $secret_keys, true ) && is_string( $value ) && '' !== $value ) {
                $values[ $key ] = str_repeat( '•', 8 );
                $values[ $key . '_set' ] = true;
            }
        }
        return $values;
    }

    private function normalize_settings_output( array $settings ) {
        foreach ( self::supported_channels() as $channel ) {
            $settings[ $channel ] = isset( $settings[ $channel ] )
                ? $this->scrub_secrets_for_output( (array) $settings[ $channel ] )
                : array();
        }
        return $settings;
    }

    // ─── Departments ─────────────────────────────────────────────────────────
    public function list_departments() {
        global $wpdb;
        $table = $wpdb->prefix . 'sme_departments';
        $rows  = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY name ASC", ARRAY_A );
        return rest_ensure_response( array_map( array( $this, 'format_department_row' ), (array) $rows ) );
    }

    public function create_department( WP_REST_Request $request ) {
        global $wpdb;
        $name = sanitize_text_field( (string) $request->get_param( 'name' ) );
        $desc = sanitize_textarea_field( (string) $request->get_param( 'description' ) );
        if ( '' === $name ) {
            return new WP_Error( 'sme_missing_name', __( 'Name is required.', 'synchronized-messaging-engine' ), array( 'status' => 400 ) );
        }

        $slug  = sanitize_title( $name );
        $table = $wpdb->prefix . 'sme_departments';

        $ok = $wpdb->insert(
            $table,
            array(
                'name'        => $name,
                'slug'        => $slug,
                'description' => $desc,
                'created_at'  => current_time( 'mysql' ),
            ),
            array( '%s', '%s', '%s', '%s' )
        );
        if ( false === $ok ) {
            return new WP_Error( 'sme_db_error', __( 'Could not create department.', 'synchronized-messaging-engine' ), array( 'status' => 500 ) );
        }

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $wpdb->insert_id ), ARRAY_A );
        return rest_ensure_response( $this->format_department_row( $row ) );
    }

    public function update_department( WP_REST_Request $request ) {
        global $wpdb;
        $id    = (int) $request->get_param( 'id' );
        $table = $wpdb->prefix . 'sme_departments';

        $data   = array();
        $format = array();
        if ( null !== $request->get_param( 'name' ) ) {
            $data['name']   = sanitize_text_field( (string) $request->get_param( 'name' ) );
            $data['slug']   = sanitize_title( $data['name'] );
            $format[]       = '%s';
            $format[]       = '%s';
        }
        if ( null !== $request->get_param( 'description' ) ) {
            $data['description'] = sanitize_textarea_field( (string) $request->get_param( 'description' ) );
            $format[]            = '%s';
        }
        if ( empty( $data ) ) {
            return new WP_Error( 'sme_nothing_to_update', __( 'Nothing to update.', 'synchronized-messaging-engine' ), array( 'status' => 400 ) );
        }

        $wpdb->update( $table, $data, array( 'id' => $id ), $format, array( '%d' ) );
        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A );
        if ( ! $row ) {
            return new WP_Error( 'sme_not_found', __( 'Department not found.', 'synchronized-messaging-engine' ), array( 'status' => 404 ) );
        }
        return rest_ensure_response( $this->format_department_row( $row ) );
    }

    public function delete_department( WP_REST_Request $request ) {
        global $wpdb;
        $id    = (int) $request->get_param( 'id' );
        $table = $wpdb->prefix . 'sme_departments';
        $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );
        $wpdb->delete( $wpdb->prefix . 'sme_agent_departments', array( 'department_id' => $id ), array( '%d' ) );
        return rest_ensure_response( array( 'deleted' => true, 'id' => $id ) );
    }

    private function format_department_row( $row ) {
        if ( ! $row ) {
            return null;
        }
        return array(
            'id'          => (int) $row['id'],
            'name'        => (string) $row['name'],
            'slug'        => (string) $row['slug'],
            'description' => (string) $row['description'],
            'createdAt'   => (string) $row['created_at'],
        );
    }

    // ─── Agents ──────────────────────────────────────────────────────────────
    public function list_agents() {
        global $wpdb;
        $users = get_users(
            array(
                'role__in' => array( Synchronized_Messaging_Engine_Activator::AGENT_ROLE, 'administrator' ),
                'fields'   => array( 'ID', 'display_name', 'user_email', 'user_login' ),
                'orderby'  => 'display_name',
                'order'    => 'ASC',
                'number'   => 200,
            )
        );

        if ( empty( $users ) ) {
            return rest_ensure_response( array() );
        }

        $table = $wpdb->prefix . 'sme_agent_departments';
        $ids   = wp_list_pluck( $users, 'ID' );
        $in    = implode( ',', array_map( 'intval', $ids ) );
        $links = array();
        if ( '' !== $in ) {
            $links = $wpdb->get_results( "SELECT user_id, department_id FROM {$table} WHERE user_id IN ({$in})", ARRAY_A );
        }
        $map = array();
        foreach ( $links as $link ) {
            $map[ (int) $link['user_id'] ][] = (int) $link['department_id'];
        }

        $out = array();
        foreach ( $users as $user ) {
            $user_obj  = get_user_by( 'id', $user->ID );
            $is_agent  = $user_obj && in_array( Synchronized_Messaging_Engine_Activator::AGENT_ROLE, (array) $user_obj->roles, true );
            $out[]     = array(
                'id'            => (int) $user->ID,
                'name'          => (string) $user->display_name,
                'email'         => (string) $user->user_email,
                'login'         => (string) $user->user_login,
                'isAgent'       => (bool) $is_agent,
                'roles'         => $user_obj ? (array) $user_obj->roles : array(),
                'departmentIds' => isset( $map[ (int) $user->ID ] ) ? $map[ (int) $user->ID ] : array(),
            );
        }
        return rest_ensure_response( $out );
    }

    public function assign_agent_departments( WP_REST_Request $request ) {
        global $wpdb;
        $user_id = (int) $request->get_param( 'id' );
        if ( $user_id <= 0 || ! get_user_by( 'id', $user_id ) ) {
            return new WP_Error( 'sme_not_found', __( 'Agent not found.', 'synchronized-messaging-engine' ), array( 'status' => 404 ) );
        }

        $department_ids = (array) $request->get_param( 'departmentIds' );
        $department_ids = array_values( array_unique( array_map( 'intval', $department_ids ) ) );

        $table = $wpdb->prefix . 'sme_agent_departments';
        $wpdb->delete( $table, array( 'user_id' => $user_id ), array( '%d' ) );

        foreach ( $department_ids as $dept_id ) {
            if ( $dept_id <= 0 ) {
                continue;
            }
            $wpdb->insert(
                $table,
                array(
                    'user_id'       => $user_id,
                    'department_id' => $dept_id,
                    'assigned_at'   => current_time( 'mysql' ),
                ),
                array( '%d', '%d', '%s' )
            );
        }

        return rest_ensure_response(
            array(
                'agentId'       => $user_id,
                'departmentIds' => $department_ids,
            )
        );
    }

    // ─── Conversations & messages ────────────────────────────────────────────
    public function list_conversations( WP_REST_Request $request ) {
        global $wpdb;
        $table   = $wpdb->prefix . 'sme_conversations';
        $channel = (string) $request->get_param( 'channel' );
        $status  = (string) $request->get_param( 'status' );

        $where  = array( '1=1' );
        $params = array();
        if ( '' !== $channel && 'all' !== $channel ) {
            $where[]  = 'channel = %s';
            $params[] = $channel;
        }
        if ( '' !== $status && 'all' !== $status ) {
            $where[]  = 'status = %s';
            $params[] = $status;
        }

        $sql  = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY updated_at DESC LIMIT 200';
        $rows = empty( $params ) ? $wpdb->get_results( $sql, ARRAY_A ) : $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );

        return rest_ensure_response( array_map( array( $this, 'format_conversation_row' ), (array) $rows ) );
    }

    public function list_messages( WP_REST_Request $request ) {
        global $wpdb;
        $cid   = (int) $request->get_param( 'id' );
        $table = $wpdb->prefix . 'sme_messages';
        $rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE conversation_id = %d ORDER BY sent_at ASC", $cid ), ARRAY_A );
        return rest_ensure_response( array_map( array( $this, 'format_message_row' ), (array) $rows ) );
    }

    public function create_conversation( WP_REST_Request $request ) {
        global $wpdb;
        $table   = $wpdb->prefix . 'sme_conversations';
        $channel = sanitize_key( (string) $request->get_param( 'channel' ) );
        if ( ! in_array( $channel, self::supported_channels(), true ) ) {
            return new WP_Error( 'sme_unknown_channel', __( 'Unknown channel.', 'synchronized-messaging-engine' ), array( 'status' => 400 ) );
        }

        $data = array(
            'channel'        => $channel,
            'external_id'    => sanitize_text_field( (string) $request->get_param( 'externalId' ) ),
            'contact_name'   => sanitize_text_field( (string) $request->get_param( 'contactName' ) ),
            'contact_handle' => sanitize_text_field( (string) $request->get_param( 'contactHandle' ) ),
            'subject'        => sanitize_text_field( (string) $request->get_param( 'subject' ) ),
            'preview'        => sanitize_textarea_field( (string) $request->get_param( 'preview' ) ),
            'status'         => sanitize_key( (string) ( $request->get_param( 'status' ) ?: 'open' ) ),
            'priority'       => sanitize_key( (string) ( $request->get_param( 'priority' ) ?: 'medium' ) ),
            'assignee_id'    => $request->get_param( 'assigneeId' ) ? (int) $request->get_param( 'assigneeId' ) : null,
            'department_id'  => $request->get_param( 'departmentId' ) ? (int) $request->get_param( 'departmentId' ) : null,
            'created_at'     => current_time( 'mysql' ),
            'updated_at'     => current_time( 'mysql' ),
        );

        $wpdb->insert( $table, $data );
        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $wpdb->insert_id ), ARRAY_A );
        return rest_ensure_response( $this->format_conversation_row( $row ) );
    }

    public function create_message( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'sme_messages';
        $cid   = (int) $request->get_param( 'conversationId' );
        if ( $cid <= 0 ) {
            return new WP_Error( 'sme_missing_conversation', __( 'conversationId is required.', 'synchronized-messaging-engine' ), array( 'status' => 400 ) );
        }
        $body = (string) $request->get_param( 'body' );
        if ( '' === trim( $body ) ) {
            return new WP_Error( 'sme_empty_body', __( 'Message body is required.', 'synchronized-messaging-engine' ), array( 'status' => 400 ) );
        }

        $sender_type = sanitize_key( (string) ( $request->get_param( 'senderType' ) ?: 'agent' ) );
        $user        = wp_get_current_user();

        $data = array(
            'conversation_id' => $cid,
            'external_id'     => sanitize_text_field( (string) $request->get_param( 'externalId' ) ),
            'sender_type'     => $sender_type,
            'sender_id'       => 'agent' === $sender_type ? (int) $user->ID : null,
            'sender_name'     => sanitize_text_field( (string) ( $request->get_param( 'senderName' ) ?: $user->display_name ) ),
            'body'            => wp_kses_post( $body ),
            'meta'            => wp_json_encode( (array) $request->get_param( 'meta' ) ),
            'sent_at'         => current_time( 'mysql' ),
        );

        $wpdb->insert( $table, $data );
        $wpdb->update(
            $wpdb->prefix . 'sme_conversations',
            array(
                'preview'    => wp_trim_words( wp_strip_all_tags( $body ), 12, '…' ),
                'updated_at' => current_time( 'mysql' ),
            ),
            array( 'id' => $cid ),
            array( '%s', '%s' ),
            array( '%d' )
        );

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $wpdb->insert_id ), ARRAY_A );
        return rest_ensure_response( $this->format_message_row( $row ) );
    }

    public function update_conversation( WP_REST_Request $request ) {
        global $wpdb;
        $id    = (int) $request->get_param( 'id' );
        $table = $wpdb->prefix . 'sme_conversations';

        $existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A );
        if ( ! $existing ) {
            return new WP_Error( 'sme_not_found', __( 'Conversation not found.', 'synchronized-messaging-engine' ), array( 'status' => 404 ) );
        }

        $data   = array();
        $format = array();

        $string_fields = array( 'status', 'priority', 'subject', 'preview' );
        foreach ( $string_fields as $field ) {
            if ( null !== $request->get_param( $field ) ) {
                $data[ $field ] = sanitize_text_field( (string) $request->get_param( $field ) );
                $format[]       = '%s';
            }
        }

        if ( $request->has_param( 'assigneeId' ) ) {
            $val                 = $request->get_param( 'assigneeId' );
            $data['assignee_id'] = $val ? (int) $val : null;
            $format[]            = '%d';
        }

        if ( $request->has_param( 'departmentId' ) ) {
            $val                   = $request->get_param( 'departmentId' );
            $data['department_id'] = $val ? (int) $val : null;
            $format[]              = '%d';
        }

        if ( $request->has_param( 'unreadCount' ) ) {
            $data['unread_count'] = max( 0, (int) $request->get_param( 'unreadCount' ) );
            $format[]             = '%d';
        }

        if ( ! empty( $data ) ) {
            $data['updated_at'] = current_time( 'mysql' );
            $format[]           = '%s';
            $wpdb->update( $table, $data, array( 'id' => $id ), $format, array( '%d' ) );
        }

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A );
        return rest_ensure_response( $this->format_conversation_row( $row ) );
    }

    private function format_conversation_row( $row ) {
        if ( ! $row ) {
            return null;
        }
        return array(
            'id'             => (int) $row['id'],
            'channel'        => (string) $row['channel'],
            'externalId'     => (string) $row['external_id'],
            'contactName'    => (string) $row['contact_name'],
            'contactHandle'  => (string) $row['contact_handle'],
            'subject'        => (string) $row['subject'],
            'preview'        => (string) $row['preview'],
            'status'         => (string) $row['status'],
            'priority'       => (string) $row['priority'],
            'assigneeId'     => $row['assignee_id'] ? (int) $row['assignee_id'] : null,
            'departmentId'   => $row['department_id'] ? (int) $row['department_id'] : null,
            'unreadCount'    => (int) $row['unread_count'],
            'createdAt'      => (string) $row['created_at'],
            'updatedAt'      => (string) $row['updated_at'],
        );
    }

    private function format_message_row( $row ) {
        if ( ! $row ) {
            return null;
        }
        $meta = json_decode( (string) $row['meta'], true );
        return array(
            'id'             => (int) $row['id'],
            'conversationId' => (int) $row['conversation_id'],
            'externalId'     => (string) $row['external_id'],
            'senderType'     => (string) $row['sender_type'],
            'senderId'       => $row['sender_id'] ? (int) $row['sender_id'] : null,
            'senderName'     => (string) $row['sender_name'],
            'body'           => (string) $row['body'],
            'meta'           => is_array( $meta ) ? $meta : array(),
            'sentAt'         => (string) $row['sent_at'],
        );
    }
}
