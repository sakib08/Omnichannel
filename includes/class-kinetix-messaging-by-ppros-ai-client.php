<?php
/**
 * Multi-provider AI client: OpenAI-compatible, Grok (xAI), Claude (Anthropic), Gemini (Google).
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Ai_Client {

    const PROVIDERS = array( 'openai', 'grok', 'claude', 'gemini', 'openai_compat' );

    /**
     * Provider API roots. AI is configured and managed inside this plugin
     * (admin picks the provider and supplies their own API key), so these
     * services are called directly; each is disclosed in readme.txt.
     */
    const ENDPOINTS = array(
        // phpcs:ignore PluginCheck.CodeAnalysis.AIProvider.DirectIntegration -- Admin-configured provider, disclosed in readme.
        'openai' => 'https://api.openai.com/v1',
        // phpcs:ignore PluginCheck.CodeAnalysis.AIProvider.DirectIntegration -- Admin-configured provider, disclosed in readme.
        'grok'   => 'https://api.x.ai/v1',
        // phpcs:ignore PluginCheck.CodeAnalysis.AIProvider.DirectIntegration -- Admin-configured provider, disclosed in readme.
        'claude' => 'https://api.anthropic.com',
        // phpcs:ignore PluginCheck.CodeAnalysis.AIProvider.DirectIntegration -- Admin-configured provider, disclosed in readme.
        'gemini' => 'https://generativelanguage.googleapis.com/v1beta',
    );

    /** @var array */
    private $cfg;

    public function __construct( array $cfg = array() ) {
        $defaults  = Kinetix_Messaging_By_Ppros_Activator::default_ai_settings();
        $this->cfg = array_merge( $defaults, $cfg );
        $provider  = sanitize_key( (string) ( $this->cfg['provider'] ?? 'openai' ) );
        if ( ! in_array( $provider, self::PROVIDERS, true ) ) {
            $provider = 'openai';
        }
        $this->cfg['provider'] = $provider;
    }

    /**
     * Load client from stored platform settings.
     *
     * @return self
     */
    public static function from_settings() {
        $all = (array) get_option( Kinetix_Messaging_By_Ppros_Activator::SETTINGS_OPTION, array() );
        $ai  = isset( $all['ai'] ) && is_array( $all['ai'] ) ? $all['ai'] : array();
        return new self( $ai );
    }

    /**
     * Provider presets (base URL + default models).
     *
     * @return array<string,array>
     */
    public static function provider_presets(): array {
        return array(
            'openai' => array(
                'label'          => 'OpenAI',
                'baseUrl'        => self::ENDPOINTS['openai'],
                'chatModel'      => 'gpt-4o-mini',
                'embeddingModel' => 'text-embedding-3-small',
                'supportsEmbed'  => true,
            ),
            'grok' => array(
                'label'          => 'Grok (xAI)',
                'baseUrl'        => self::ENDPOINTS['grok'],
                'chatModel'      => 'grok-3-mini',
                'embeddingModel' => '',
                'supportsEmbed'  => false,
            ),
            'claude' => array(
                'label'          => 'Claude (Anthropic)',
                'baseUrl'        => self::ENDPOINTS['claude'],
                'chatModel'      => 'claude-sonnet-4-5',
                'embeddingModel' => '',
                'supportsEmbed'  => false,
            ),
            'gemini' => array(
                'label'          => 'Gemini (Google)',
                'baseUrl'        => self::ENDPOINTS['gemini'],
                'chatModel'      => 'gemini-2.0-flash',
                'embeddingModel' => 'text-embedding-004',
                'supportsEmbed'  => true,
            ),
            'openai_compat' => array(
                'label'          => 'OpenAI-compatible (custom)',
                'baseUrl'        => self::ENDPOINTS['openai'],
                'chatModel'      => 'gpt-4o-mini',
                'embeddingModel' => 'text-embedding-3-small',
                'supportsEmbed'  => true,
            ),
        );
    }

    /**
     * @return array
     */
    public function get_config() {
        return $this->cfg;
    }

    /**
     * Current provider slug.
     */
    public function get_provider(): string {
        return (string) ( $this->cfg['provider'] ?? 'openai' );
    }

    /**
     * Whether the client has enough config to call the API.
     */
    public function is_configured(): bool {
        // readme.txt promises no provider calls while AI Support is off.
        if ( empty( $this->cfg['enabled'] ) ) {
            return false;
        }
        if ( '' === trim( (string) ( $this->cfg['apiKey'] ?? '' ) ) ) {
            return false;
        }
        $provider = $this->get_provider();
        // Claude / Gemini resolve URLs from presets; baseUrl optional but used when set.
        if ( in_array( $provider, array( 'claude', 'gemini' ), true ) ) {
            return true;
        }
        return '' !== trim( (string) ( $this->cfg['baseUrl'] ?? '' ) );
    }

    /**
     * Whether this provider can produce embeddings (else RAG uses keyword fallback).
     */
    public function supports_embeddings(): bool {
        $presets = self::provider_presets();
        $p       = $this->get_provider();
        if ( isset( $presets[ $p ] ) && empty( $presets[ $p ]['supportsEmbed'] ) ) {
            return false;
        }
        return '' !== trim( (string) ( $this->cfg['embeddingModel'] ?? '' ) );
    }

    /**
     * Chat completion. Returns assistant text or WP_Error.
     *
     * @param array $messages OpenAI-style messages.
     * @param array $opts     Optional: temperature, response_format, max_tokens.
     * @return string|\WP_Error
     */
    public function chat( array $messages, array $opts = array() ) {
        if ( ! $this->is_configured() ) {
            return new WP_Error(
                'kmbp_ai_not_configured',
                __( 'AI API key is required.', 'kinetix-messaging-by-ppros' ),
                array( 'status' => 400 )
            );
        }

        switch ( $this->get_provider() ) {
            case 'claude':
                return $this->chat_claude( $messages, $opts );
            case 'gemini':
                return $this->chat_gemini( $messages, $opts );
            case 'grok':
            case 'openai':
            case 'openai_compat':
            default:
                return $this->chat_openai( $messages, $opts );
        }
    }

    /**
     * Embed one or more texts. Returns list of float vectors or WP_Error.
     * Providers without embeddings return WP_Error so callers can fall back.
     *
     * @param string|array $input
     * @return array|\WP_Error  List of float arrays (one per input).
     */
    public function embed( $input ) {
        $inputs = is_array( $input ) ? array_values( $input ) : array( (string) $input );
        $inputs = array_map( 'strval', $inputs );
        if ( empty( $inputs ) ) {
            return array();
        }

        if ( ! $this->supports_embeddings() ) {
            return new WP_Error(
                'kmbp_ai_no_embeddings',
                __( 'This AI provider does not support embeddings; keyword search will be used.', 'kinetix-messaging-by-ppros' )
            );
        }

        if ( 'gemini' === $this->get_provider() ) {
            return $this->embed_gemini( $inputs );
        }

        return $this->embed_openai( $inputs );
    }

    // ── OpenAI / Grok / compatible ─────────────────────────────────────────

    private function chat_openai( array $messages, array $opts ) {
        $payload = array(
            'model'       => (string) ( $this->cfg['chatModel'] ?? 'gpt-4o-mini' ),
            'messages'    => $messages,
            'temperature' => isset( $opts['temperature'] ) ? (float) $opts['temperature'] : 0.3,
        );
        if ( ! empty( $opts['response_format'] ) ) {
            $payload['response_format'] = $opts['response_format'];
        }
        if ( isset( $opts['max_tokens'] ) ) {
            $payload['max_tokens'] = (int) $opts['max_tokens'];
        }

        $data = $this->http_json(
            $this->openai_url( '/chat/completions' ),
            $payload,
            array(
                'Authorization' => 'Bearer ' . (string) $this->cfg['apiKey'],
            )
        );
        if ( is_wp_error( $data ) ) {
            return $data;
        }

        $text = $data['choices'][0]['message']['content'] ?? '';
        return $this->normalize_text( $text );
    }

    private function embed_openai( array $inputs ) {
        $payload = array(
            'model' => (string) ( $this->cfg['embeddingModel'] ?? 'text-embedding-3-small' ),
            'input' => count( $inputs ) === 1 ? $inputs[0] : $inputs,
        );

        $data = $this->http_json(
            $this->openai_url( '/embeddings' ),
            $payload,
            array(
                'Authorization' => 'Bearer ' . (string) $this->cfg['apiKey'],
            )
        );
        if ( is_wp_error( $data ) ) {
            return $data;
        }

        $rows = isset( $data['data'] ) && is_array( $data['data'] ) ? $data['data'] : array();
        usort(
            $rows,
            static function ( $a, $b ) {
                return ( (int) ( $a['index'] ?? 0 ) ) <=> ( (int) ( $b['index'] ?? 0 ) );
            }
        );

        $out = array();
        foreach ( $rows as $row ) {
            $vec   = isset( $row['embedding'] ) && is_array( $row['embedding'] ) ? $row['embedding'] : array();
            $out[] = array_map( 'floatval', $vec );
        }
        return $out;
    }

    private function openai_url( string $path ): string {
        $base = rtrim( (string) ( $this->cfg['baseUrl'] ?? '' ), '/' );
        if ( '' === $base ) {
            $presets = self::provider_presets();
            $p       = $this->get_provider();
            $base    = rtrim( (string) ( $presets[ $p ]['baseUrl'] ?? self::ENDPOINTS['openai'] ), '/' );
        }
        return $base . '/' . ltrim( $path, '/' );
    }

    // ── Claude (Anthropic Messages API) ────────────────────────────────────

    private function chat_claude( array $messages, array $opts ) {
        $system   = '';
        $contents = array();
        foreach ( $messages as $msg ) {
            $role = (string) ( $msg['role'] ?? 'user' );
            $text = (string) ( $msg['content'] ?? '' );
            if ( 'system' === $role ) {
                $system .= ( '' === $system ? '' : "\n\n" ) . $text;
                continue;
            }
            $contents[] = array(
                'role'    => 'assistant' === $role ? 'assistant' : 'user',
                'content' => $text,
            );
        }

        // Anthropic requires alternating user/assistant; merge consecutive same roles.
        $contents = $this->merge_consecutive_roles( $contents );
        if ( empty( $contents ) ) {
            return new WP_Error( 'kmbp_ai_empty', __( 'No messages to send.', 'kinetix-messaging-by-ppros' ) );
        }
        if ( 'assistant' === $contents[0]['role'] ) {
            array_unshift( $contents, array( 'role' => 'user', 'content' => '(continue)' ) );
        }

        $max_tokens = isset( $opts['max_tokens'] ) ? (int) $opts['max_tokens'] : 1024;
        $payload    = array(
            'model'      => (string) ( $this->cfg['chatModel'] ?? 'claude-sonnet-4-5' ),
            'max_tokens' => max( 64, $max_tokens ),
            'messages'   => $contents,
        );
        if ( '' !== $system ) {
            $payload['system'] = $system;
        }
        if ( isset( $opts['temperature'] ) ) {
            $payload['temperature'] = (float) $opts['temperature'];
        }

        // Force JSON when requested (append instruction; Anthropic has no response_format like OpenAI).
        if ( ! empty( $opts['response_format'] ) && 'json_object' === ( $opts['response_format']['type'] ?? '' ) ) {
            $payload['system'] = ( $payload['system'] ?? '' ) . "\n\nRespond with valid JSON only, no markdown.";
        }

        $base = rtrim( (string) ( $this->cfg['baseUrl'] ?? '' ), '/' );
        if ( '' === $base ) {
            $base = self::ENDPOINTS['claude'];
        }
        $url = $base . '/v1/messages';

        $data = $this->http_json(
            $url,
            $payload,
            array(
                'x-api-key'         => (string) $this->cfg['apiKey'],
                'anthropic-version' => '2023-06-01',
            )
        );
        if ( is_wp_error( $data ) ) {
            return $data;
        }

        $text = '';
        if ( ! empty( $data['content'] ) && is_array( $data['content'] ) ) {
            foreach ( $data['content'] as $block ) {
                if ( isset( $block['type'] ) && 'text' === $block['type'] && isset( $block['text'] ) ) {
                    $text .= (string) $block['text'];
                }
            }
        }
        return $this->normalize_text( $text );
    }

    /**
     * @param array<int,array{role:string,content:string}> $messages
     * @return array<int,array{role:string,content:string}>
     */
    private function merge_consecutive_roles( array $messages ): array {
        $out = array();
        foreach ( $messages as $msg ) {
            if ( empty( $out ) ) {
                $out[] = $msg;
                continue;
            }
            $last = count( $out ) - 1;
            if ( $out[ $last ]['role'] === $msg['role'] ) {
                $out[ $last ]['content'] .= "\n\n" . $msg['content'];
            } else {
                $out[] = $msg;
            }
        }
        return $out;
    }

    // ── Gemini (Google Generative Language API) ────────────────────────────

    private function chat_gemini( array $messages, array $opts ) {
        $system   = '';
        $contents = array();
        foreach ( $messages as $msg ) {
            $role = (string) ( $msg['role'] ?? 'user' );
            $text = (string) ( $msg['content'] ?? '' );
            if ( 'system' === $role ) {
                $system .= ( '' === $system ? '' : "\n\n" ) . $text;
                continue;
            }
            $contents[] = array(
                'role'  => 'assistant' === $role ? 'model' : 'user',
                'parts' => array( array( 'text' => $text ) ),
            );
        }

        if ( ! empty( $opts['response_format'] ) && 'json_object' === ( $opts['response_format']['type'] ?? '' ) ) {
            $system .= ( '' === $system ? '' : "\n\n" ) . 'Respond with valid JSON only, no markdown.';
        }

        $model = (string) ( $this->cfg['chatModel'] ?? 'gemini-2.0-flash' );
        $url   = $this->gemini_model_url( $model, 'generateContent' );

        $payload = array(
            'contents'         => $contents,
            'generationConfig' => array(
                'temperature' => isset( $opts['temperature'] ) ? (float) $opts['temperature'] : 0.3,
            ),
        );
        if ( isset( $opts['max_tokens'] ) ) {
            $payload['generationConfig']['maxOutputTokens'] = (int) $opts['max_tokens'];
        }
        if ( '' !== $system ) {
            $payload['systemInstruction'] = array(
                'parts' => array( array( 'text' => $system ) ),
            );
        }

        $data = $this->http_json( $url, $payload, array() );
        if ( is_wp_error( $data ) ) {
            return $data;
        }

        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        return $this->normalize_text( $text );
    }

    /**
     * @param string[] $inputs
     * @return array|\WP_Error
     */
    private function embed_gemini( array $inputs ) {
        $model = (string) ( $this->cfg['embeddingModel'] ?? 'text-embedding-004' );
        $out   = array();

        foreach ( $inputs as $text ) {
            $url     = $this->gemini_model_url( $model, 'embedContent' );
            $payload = array(
                'model'   => 'models/' . ltrim( $model, '/' ),
                'content' => array(
                    'parts' => array( array( 'text' => $text ) ),
                ),
            );
            $data = $this->http_json( $url, $payload, array() );
            if ( is_wp_error( $data ) ) {
                return $data;
            }
            $vec = $data['embedding']['values'] ?? array();
            if ( ! is_array( $vec ) || empty( $vec ) ) {
                return new WP_Error( 'kmbp_ai_empty', __( 'Gemini returned an empty embedding.', 'kinetix-messaging-by-ppros' ) );
            }
            $out[] = array_map( 'floatval', $vec );
        }
        return $out;
    }

    private function gemini_model_url( string $model, string $method ): string {
        $base = rtrim( (string) ( $this->cfg['baseUrl'] ?? '' ), '/' );
        if ( '' === $base ) {
            $base = self::ENDPOINTS['gemini'];
        }
        $model = preg_replace( '#^models/#', '', $model );
        $key   = rawurlencode( (string) $this->cfg['apiKey'] );
        return $base . '/models/' . rawurlencode( $model ) . ':' . $method . '?key=' . $key;
    }

    // ── Shared HTTP ────────────────────────────────────────────────────────

    /**
     * @param string               $url
     * @param array                $payload
     * @param array<string,string> $extra_headers
     * @return array|\WP_Error
     */
    private function http_json( string $url, array $payload, array $extra_headers ) {
        $headers = array_merge(
            array( 'Content-Type' => 'application/json' ),
            $extra_headers
        );

        $response = wp_remote_post(
            $url,
            array(
                'timeout' => 60,
                'headers' => $headers,
                'body'    => wp_json_encode( $payload ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = (int) wp_remote_retrieve_response_code( $response );
        $body = (string) wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true );

        if ( $code < 200 || $code >= 300 ) {
            $msg = $this->extract_error_message( $data, $code );
            return new WP_Error( 'kmbp_ai_http', $msg, array( 'status' => $code, 'body' => $data ) );
        }

        return is_array( $data ) ? $data : array();
    }

    /**
     * @param mixed $data
     */
    private function extract_error_message( $data, int $code ): string {
        if ( ! is_array( $data ) ) {
            return sprintf( 'AI HTTP %d', $code );
        }
        if ( isset( $data['error']['message'] ) ) {
            return (string) $data['error']['message'];
        }
        if ( isset( $data['error']['status'] ) && isset( $data['error']['message'] ) ) {
            return (string) $data['error']['message'];
        }
        // Gemini style: error.message
        if ( isset( $data['message'] ) ) {
            return (string) $data['message'];
        }
        return sprintf( 'AI HTTP %d', $code );
    }

    /**
     * @param mixed $text
     * @return string|\WP_Error
     */
    private function normalize_text( $text ) {
        if ( ! is_string( $text ) || '' === trim( $text ) ) {
            return new WP_Error( 'kmbp_ai_empty', __( 'AI returned an empty response.', 'kinetix-messaging-by-ppros' ) );
        }
        return trim( $text );
    }
}
