<?php
/**
 * AI conversation orchestrator — greets, routes, RAG-answers, and hands off.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Ai {

    /** @var Kinetix_Messaging_By_Ppros_Ai_Client */
    private $client;

    /** @var Kinetix_Messaging_By_Ppros_Ai_Rag */
    private $rag;

    /** @var Kinetix_Messaging_By_Ppros_Ai_Router */
    private $router;

    public function __construct() {
        $this->client = Kinetix_Messaging_By_Ppros_Ai_Client::from_settings();
        $this->rag    = new Kinetix_Messaging_By_Ppros_Ai_Rag( $this->client );
        $this->router = new Kinetix_Messaging_By_Ppros_Ai_Router();
    }

    /**
     * Register hooks on the plugin loader.
     */
    public function register_hooks( Kinetix_Messaging_By_Ppros_Loader $loader ): void {
        $loader->add_action( 'kmbp_inbound_message_received', $this, 'on_inbound_message', 20, 3 );
        $loader->add_action( 'kmbp_inbound_email_received', $this, 'on_inbound_email', 20, 2 );
        $loader->add_action( 'save_post', $this, 'on_save_post', 20, 2 );
        $loader->add_action( 'before_delete_post', $this, 'on_delete_post', 10, 1 );
    }

    /**
     * @param int    $conversation_id
     * @param string $channel
     * @param array  $context
     */
    public function on_inbound_message( $conversation_id, $channel, $context = array() ): void {
        $text = '';
        if ( is_array( $context ) ) {
            $text = (string) ( $context['text'] ?? $context['body'] ?? '' );
        }
        $this->handle( (int) $conversation_id, (string) $channel, $text, is_array( $context ) ? $context : array() );
    }

    /**
     * @param int   $conversation_id
     * @param array $email_data
     */
    public function on_inbound_email( $conversation_id, $email_data = array() ): void {
        $text = '';
        if ( is_array( $email_data ) ) {
            $text = (string) ( $email_data['text'] ?? $email_data['body'] ?? $email_data['subject'] ?? '' );
        }
        $this->handle( (int) $conversation_id, 'email', $text, is_array( $email_data ) ? $email_data : array() );
    }

    /**
     * Index published posts/pages when AI WP indexing is enabled.
     *
     * @param int      $post_id
     * @param \WP_Post $post
     */
    public function on_save_post( $post_id, $post = null ): void {
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        if ( wp_is_post_revision( $post_id ) ) {
            return;
        }
        $cfg = $this->client->get_config();
        if ( empty( $cfg['enabled'] ) || empty( $cfg['indexWpContent'] ) ) {
            return;
        }
        $post = $post ?: get_post( $post_id );
        if ( ! $post || ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
            return;
        }
        if ( 'publish' !== $post->post_status ) {
            $this->rag->remove_wp_post( (int) $post_id );
            return;
        }
        $this->rag->upsert_wp_post( $post );
    }

    /**
     * @param int $post_id
     */
    public function on_delete_post( $post_id ): void {
        $this->rag->remove_wp_post( (int) $post_id );
    }

    /**
     * Main AI decision loop for an inbound contact message.
     */
    private function handle( int $conversation_id, string $channel, string $text, array $context ): void {
        if ( $conversation_id <= 0 ) {
            return;
        }

        $cfg = $this->client->get_config();
        if ( empty( $cfg['enabled'] ) ) {
            return;
        }

        $conv = $this->get_conversation( $conversation_id );
        if ( ! $conv ) {
            return;
        }

        // Human already assigned — stay out.
        if ( ! empty( $conv['assignee_id'] ) && 'active' !== (string) ( $conv['ai_status'] ?? '' ) ) {
            return;
        }
        if ( ! empty( $conv['assignee_id'] ) && 'active' === (string) ( $conv['ai_status'] ?? '' ) ) {
            // Agent was assigned while AI was active — stop.
            $this->set_ai_status( $conversation_id, null );
            return;
        }

        if ( 'handed_off' === (string) ( $conv['ai_status'] ?? '' ) ) {
            return;
        }

        $text = trim( wp_strip_all_tags( $text ) );
        if ( '' === $text ) {
            return;
        }

        // Activate AI on first eligible message.
        if ( empty( $conv['ai_status'] ) ) {
            $this->set_ai_status( $conversation_id, 'active' );
            $welcome = (string) ( $cfg['welcomeMsg'] ?? '' );
            if ( '' !== trim( $welcome ) && $this->is_first_contact_message( $conversation_id ) ) {
                $this->send_reply( $conversation_id, $channel, $conv, $welcome, $context );
            }
        }

        // User wants a human.
        if ( $this->wants_human( $text ) ) {
            $this->do_handoff( $conversation_id, $channel, $conv, $context, $cfg );
            return;
        }

        $decision = $this->classify( $text, $conversation_id );
        $action   = (string) ( $decision['action'] ?? 'answer' );

        if ( 'handoff' === $action ) {
            $this->do_handoff( $conversation_id, $channel, $conv, $context, $cfg );
            return;
        }

        if ( 'route' === $action && ! empty( $decision['departmentSlug'] ) ) {
            $routed = $this->do_route( $conversation_id, $channel, $conv, $context, $cfg, (string) $decision['departmentSlug'], (string) ( $decision['reply'] ?? '' ) );
            if ( $routed ) {
                return;
            }
        }

        // No agents mapped site-wide → always RAG.
        // Or action is answer / route failed → RAG (or clarify reply from model).
        $reply = (string) ( $decision['reply'] ?? '' );
        if ( 'answer' === $action || '' === $reply || ! $this->router->has_any_mapped_agents() ) {
            $history = $this->get_recent_history( $conversation_id );
            $rag     = $this->rag->answer( $text, $history );
            if ( ! is_wp_error( $rag ) && '' !== trim( (string) $rag ) ) {
                $reply = (string) $rag;
            } elseif ( '' === $reply ) {
                $reply = __( "I'm not sure about that yet. Would you like me to connect you with a human agent?", 'kinetix-messaging-by-ppros' );
            }
        }

        if ( '' !== trim( $reply ) ) {
            $this->send_reply( $conversation_id, $channel, $conv, $reply, $context );
        }
    }

    /**
     * Classify intent via LLM JSON; falls back to heuristics.
     *
     * @return array{action:string,departmentSlug?:string,reply?:string}
     */
    private function classify( string $text, int $conversation_id ): array {
        if ( $this->wants_human( $text ) ) {
            return array( 'action' => 'handoff' );
        }

        $departments = $this->router->list_departments();
        $dept_list   = array();
        foreach ( $departments as $d ) {
            $dept_list[] = $d['slug'] . ' (' . $d['name'] . ')';
        }
        $dept_hint = ! empty( $dept_list ) ? implode( ', ', $dept_list ) : '(none configured)';

        if ( ! $this->client->is_configured() ) {
            // Heuristic keyword routing.
            $lower = strtolower( $text );
            foreach ( $departments as $d ) {
                if ( false !== strpos( $lower, strtolower( $d['slug'] ) )
                    || false !== strpos( $lower, strtolower( $d['name'] ) ) ) {
                    return array(
                        'action'         => 'route',
                        'departmentSlug' => $d['slug'],
                        'reply'          => '',
                    );
                }
            }
            return array( 'action' => 'answer', 'reply' => '' );
        }

        $system = 'You are a support routing assistant. Given the customer message and available departments, '
            . 'respond with ONLY a JSON object (no markdown) of the form: '
            . '{"action":"handoff"|"route"|"answer","departmentSlug":"<slug or empty>","reply":"<short reply or empty>"}. '
            . 'Use handoff if they want a human. Use route if you can match a department. '
            . 'Use answer for general questions (leave reply empty so RAG fills it). '
            . 'Available departments: ' . $dept_hint;

        $history  = $this->get_recent_history( $conversation_id );
        $messages = array( array( 'role' => 'system', 'content' => $system ) );
        foreach ( array_slice( $history, -6 ) as $turn ) {
            $messages[] = array(
                'role'    => 'assistant' === ( $turn['role'] ?? '' ) ? 'assistant' : 'user',
                'content' => (string) ( $turn['content'] ?? '' ),
            );
        }
        $messages[] = array( 'role' => 'user', 'content' => $text );

        $raw = $this->client->chat(
            $messages,
            array(
                'temperature'     => 0.1,
                'response_format' => array( 'type' => 'json_object' ),
            )
        );

        if ( is_wp_error( $raw ) ) {
            return array( 'action' => 'answer', 'reply' => '' );
        }

        $decoded = json_decode( $raw, true );
        if ( ! is_array( $decoded ) ) {
            // Try extract JSON object.
            if ( preg_match( '/\{.*\}/s', $raw, $m ) ) {
                $decoded = json_decode( $m[0], true );
            }
        }
        if ( ! is_array( $decoded ) ) {
            return array( 'action' => 'answer', 'reply' => '' );
        }

        $action = sanitize_key( (string) ( $decoded['action'] ?? 'answer' ) );
        if ( ! in_array( $action, array( 'handoff', 'route', 'answer' ), true ) ) {
            $action = 'answer';
        }

        return array(
            'action'         => $action,
            'departmentSlug' => sanitize_title( (string) ( $decoded['departmentSlug'] ?? '' ) ),
            'reply'          => sanitize_textarea_field( (string) ( $decoded['reply'] ?? '' ) ),
        );
    }

    private function wants_human( string $text ): bool {
        $lower = strtolower( $text );
        $phrases = array(
            'talk to a human',
            'talk to human',
            'speak to a human',
            'speak to human',
            'real agent',
            'real person',
            'human agent',
            'live agent',
            'speak to an agent',
            'talk to an agent',
            'no ai',
            "don't want ai",
            'dont want ai',
            'stop ai',
            'transfer me',
            'connect me to an agent',
            'connect me with an agent',
            'agent please',
        );
        foreach ( $phrases as $p ) {
            if ( false !== strpos( $lower, $p ) ) {
                return true;
            }
        }
        return false;
    }

    /**
     * @return bool True if routing completed (and AI stopped or handed to admin).
     */
    private function do_route( int $conversation_id, string $channel, array $conv, array $context, array $cfg, string $dept_slug, string $extra_reply ): bool {
        $dept = $this->router->find_department( $dept_slug );
        if ( ! $dept ) {
            return false;
        }

        $agents = $this->router->find_available_agents( (int) $dept['id'] );

        if ( ! empty( $agents ) ) {
            $agent_id = $this->router->pick_least_loaded( $agents );
            $this->update_conversation(
                $conversation_id,
                array(
                    'department_id' => (int) $dept['id'],
                    'assignee_id'   => $agent_id,
                    'ai_status'     => null,
                )
            );
            $agent = get_userdata( $agent_id );
            $label = $agent ? $agent->display_name : __( 'an agent', 'kinetix-messaging-by-ppros' );
            $msg   = sprintf(
                /* translators: 1: department name, 2: agent name */
                __( "I've connected you with %2\$s from %1\$s. They'll take it from here.", 'kinetix-messaging-by-ppros' ),
                $dept['name'],
                $label
            );
            if ( '' !== trim( $extra_reply ) ) {
                $msg = trim( $extra_reply ) . "\n\n" . $msg;
            }
            $this->send_reply( $conversation_id, $channel, $conv, $msg, $context );
            return true;
        }

        // No agents in department → assign admin for manual routing.
        $admin_id = $this->router->get_fallback_admin_id();
        $this->update_conversation(
            $conversation_id,
            array(
                'department_id' => (int) $dept['id'],
                'assignee_id'   => $admin_id > 0 ? $admin_id : null,
                'ai_status'     => 'handed_off',
            )
        );
        $msg = sprintf(
            /* translators: %s: department name */
            __( "I've flagged this for our %s team. An admin will assign the right agent shortly. Please wait.", 'kinetix-messaging-by-ppros' ),
            $dept['name']
        );
        if ( '' !== trim( $extra_reply ) ) {
            $msg = trim( $extra_reply ) . "\n\n" . $msg;
        }
        $this->send_reply( $conversation_id, $channel, $conv, $msg, $context );
        return true;
    }

    private function do_handoff( int $conversation_id, string $channel, array $conv, array $context, array $cfg ): void {
        $wait = (string) ( $cfg['waitForAgentMsg'] ?? '' );
        if ( '' === trim( $wait ) ) {
            $wait = __( 'Please wait while we connect you to an agent.', 'kinetix-messaging-by-ppros' );
        }

        $this->update_conversation(
            $conversation_id,
            array(
                'ai_status'   => 'handed_off',
                'assignee_id' => null,
            )
        );

        $this->send_reply( $conversation_id, $channel, $conv, $wait, $context );
    }

    /**
     * Send an AI reply on the conversation's channel.
     */
    private function send_reply( int $conversation_id, string $channel, array $conv, string $text, array $context ): void {
        $cfg          = $this->client->get_config();
        $sender_name  = (string) ( $cfg['assistantName'] ?? 'AI Assistant' );
        $recipient_id = $this->resolve_recipient( $conv, $context );

        if ( 'email' === $channel ) {
            $this->send_email_reply( $conversation_id, $conv, $text, $sender_name );
            return;
        }

        $pipe = $this->get_pipe( $channel );
        if ( $pipe && '' !== $recipient_id ) {
            $result = $pipe->deliver_ai_message( $conversation_id, $recipient_id, $text, $sender_name );
            if ( ! is_wp_error( $result ) ) {
                return;
            }
        }

        // Fallback: store only so inbox still shows the AI reply.
        $this->store_ai_message( $conversation_id, $text, $sender_name );
    }

    private function send_email_reply( int $conversation_id, array $conv, string $text, string $sender_name ): void {
        $to = (string) ( $conv['contact_handle'] ?? '' );
        if ( is_email( $to ) && class_exists( 'Kinetix_Messaging_By_Ppros_Email_Pipe' ) ) {
            $pipe    = new Kinetix_Messaging_By_Ppros_Email_Pipe();
            $subject = 'Re: ' . ( (string) ( $conv['subject'] ?? 'Support' ) );
            $html    = nl2br( esc_html( $text ) );
            $result  = $pipe->send_via_smtp( $to, (string) ( $conv['contact_name'] ?? '' ), $subject, $html );
            // Always store regardless of SMTP outcome.
            unset( $result );
        }
        $this->store_ai_message( $conversation_id, $text, $sender_name );
    }

    private function store_ai_message( int $conversation_id, string $text, string $sender_name ): void {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $wpdb->insert(
            $wpdb->prefix . 'kmbp_messages',
            array(
                'conversation_id' => $conversation_id,
                'external_id'     => '',
                'sender_type'     => 'agent',
                'sender_id'       => null,
                'sender_name'     => $sender_name,
                'body'            => wp_kses_post( $text ),
                'meta'            => wp_json_encode( array( 'ai' => true, 'direction' => 'outbound' ) ),
                'sent_at'         => current_time( 'mysql' ),
            ),
            array( '%d', '%s', '%s', null, '%s', '%s', '%s', '%s' )
        );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $wpdb->update(
            $wpdb->prefix . 'kmbp_conversations',
            array(
                'preview'    => wp_trim_words( wp_strip_all_tags( $text ), 14, '…' ),
                'updated_at' => current_time( 'mysql' ),
            ),
            array( 'id' => $conversation_id ),
            array( '%s', '%s' ),
            array( '%d' )
        );
    }

    private function resolve_recipient( array $conv, array $context ): string {
        foreach ( array( 'chatId', 'from', 'psid', 'igsid', 'userId', 'openId', 'recipientId' ) as $key ) {
            if ( ! empty( $context[ $key ] ) ) {
                return (string) $context[ $key ];
            }
        }
        return (string) ( $conv['external_id'] ?? '' );
    }

    /**
     * @return Kinetix_Messaging_By_Ppros_Channel_Pipe_Base|null
     */
    private function get_pipe( string $channel ) {
        $map = array(
            'telegram'  => 'Kinetix_Messaging_By_Ppros_Telegram_Pipe',
            'whatsapp'  => 'Kinetix_Messaging_By_Ppros_Whatsapp_Pipe',
            'messenger' => 'Kinetix_Messaging_By_Ppros_Messenger_Pipe',
            'wechat'    => 'Kinetix_Messaging_By_Ppros_Wechat_Pipe',
            'sms'       => 'Kinetix_Messaging_By_Ppros_Sms_Pipe',
            'line'      => 'Kinetix_Messaging_By_Ppros_Line_Pipe',
            'instagram' => 'Kinetix_Messaging_By_Ppros_Instagram_Pipe',
            'viber'     => 'Kinetix_Messaging_By_Ppros_Viber_Pipe',
            'livechat'  => 'Kinetix_Messaging_By_Ppros_Livechat_Pipe',
        );
        if ( ! isset( $map[ $channel ] ) || ! class_exists( $map[ $channel ] ) ) {
            return null;
        }
        return new $map[ $channel ]();
    }

    private function get_conversation( int $id ) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        return $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}kmbp_conversations WHERE id = %d", $id ),
            ARRAY_A
        );
    }

    private function set_ai_status( int $conversation_id, $status ): void {
        $this->update_conversation( $conversation_id, array( 'ai_status' => $status ) );
    }

    /**
     * @param array $fields Column => value (supports null).
     */
    private function update_conversation( int $conversation_id, array $fields ): void {
        global $wpdb;

        // wpdb::update does not reliably set NULL; use explicit SQL for nullables.
        $sets   = array();
        $params = array();
        foreach ( $fields as $col => $val ) {
            $col = preg_replace( '/[^a-z0-9_]/', '', (string) $col );
            if ( '' === $col ) {
                continue;
            }
            if ( null === $val ) {
                $sets[] = "`{$col}` = NULL";
            } elseif ( is_int( $val ) ) {
                $sets[]   = "`{$col}` = %d";
                $params[] = $val;
            } else {
                $sets[]   = "`{$col}` = %s";
                $params[] = (string) $val;
            }
        }
        if ( empty( $sets ) ) {
            return;
        }
        $sets[]   = '`updated_at` = %s';
        $params[] = current_time( 'mysql' );
        $params[] = $conversation_id;

        $sql = "UPDATE {$wpdb->prefix}kmbp_conversations SET " . implode( ', ', $sets ) . ' WHERE id = %d';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
        $wpdb->query( $wpdb->prepare( $sql, $params ) );
    }

    private function is_first_contact_message( int $conversation_id ): bool {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $count = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}kmbp_messages
                 WHERE conversation_id = %d AND sender_type = 'contact'",
                $conversation_id
            )
        );
        return $count <= 1;
    }

    /**
     * @return array<int,array{role:string,content:string}>
     */
    private function get_recent_history( int $conversation_id ): array {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT sender_type, body, meta FROM {$wpdb->prefix}kmbp_messages
                 WHERE conversation_id = %d ORDER BY sent_at DESC LIMIT 12",
                $conversation_id
            ),
            ARRAY_A
        );
        $out = array();
        foreach ( array_reverse( (array) $rows ) as $row ) {
            $meta = json_decode( (string) ( $row['meta'] ?? '' ), true );
            $role = 'contact' === $row['sender_type'] ? 'user' : 'assistant';
            $out[] = array(
                'role'    => $role,
                'content' => wp_strip_all_tags( (string) $row['body'] ),
                'ai'      => ! empty( $meta['ai'] ),
            );
        }
        return $out;
    }
}
