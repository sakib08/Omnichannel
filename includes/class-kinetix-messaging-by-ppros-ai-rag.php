<?php
/**
 * RAG knowledge base: chunk, embed, search, and answer.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Ai_Rag {

    const CHUNK_SIZE    = 700;
    const CHUNK_OVERLAP = 100;
    const TOP_K         = 5;

    /** @var Kinetix_Messaging_By_Ppros_Ai_Client */
    private $client;

    public function __construct( ?Kinetix_Messaging_By_Ppros_Ai_Client $client = null ) {
        $this->client = $client ?: Kinetix_Messaging_By_Ppros_Ai_Client::from_settings();
    }

    /**
     * Upsert a manual KB document and re-embed chunks.
     *
     * @param string   $title
     * @param string   $content
     * @param int|null $id      Existing document ID to update.
     * @return int|\WP_Error Document ID.
     */
    public function upsert_manual_document( string $title, string $content, $id = null ) {
        global $wpdb;
        $title   = sanitize_text_field( $title );
        $content = wp_kses_post( $content );
        $now     = current_time( 'mysql' );

        if ( $id ) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->update(
                $wpdb->prefix . 'kmbp_kb_documents',
                array(
                    'title'      => $title,
                    'content'    => $content,
                    'status'     => 'active',
                    'updated_at' => $now,
                ),
                array( 'id' => (int) $id ),
                array( '%s', '%s', '%s', '%s' ),
                array( '%d' )
            );
            $doc_id = (int) $id;
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->insert(
                $wpdb->prefix . 'kmbp_kb_documents',
                array(
                    'title'       => $title,
                    'source_type' => 'manual',
                    'source_id'   => null,
                    'content'     => $content,
                    'status'      => 'active',
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ),
                array( '%s', '%s', null, '%s', '%s', '%s', '%s' )
            );
            $doc_id = (int) $wpdb->insert_id;
        }

        if ( $doc_id <= 0 ) {
            return new WP_Error( 'kmbp_kb_save', __( 'Could not save knowledge base document.', 'kinetix-messaging-by-ppros' ) );
        }

        $embed = $this->reindex_document( $doc_id );
        if ( is_wp_error( $embed ) ) {
            return $embed;
        }
        return $doc_id;
    }

    /**
     * Delete a KB document and its chunks.
     */
    public function delete_document( int $id ): bool {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $wpdb->delete( $wpdb->prefix . 'kmbp_kb_chunks', array( 'document_id' => $id ), array( '%d' ) );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $deleted = $wpdb->delete( $wpdb->prefix . 'kmbp_kb_documents', array( 'id' => $id ), array( '%d' ) );
        return false !== $deleted;
    }

    /**
     * List KB documents (without embeddings).
     *
     * @param string|null $source_type Filter by source_type.
     * @return array
     */
    public function list_documents( $source_type = null ): array {
        global $wpdb;
        if ( $source_type ) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $rows = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT id, title, source_type, source_id, content, status, created_at, updated_at
                     FROM {$wpdb->prefix}kmbp_kb_documents WHERE source_type = %s ORDER BY updated_at DESC",
                    $source_type
                ),
                ARRAY_A
            );
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $rows = $wpdb->get_results(
                "SELECT id, title, source_type, source_id, content, status, created_at, updated_at
                 FROM {$wpdb->prefix}kmbp_kb_documents ORDER BY updated_at DESC LIMIT 500",
                ARRAY_A
            );
        }

        $out = array();
        foreach ( (array) $rows as $row ) {
            $out[] = array(
                'id'         => (int) $row['id'],
                'title'      => (string) $row['title'],
                'sourceType' => (string) $row['source_type'],
                'sourceId'   => $row['source_id'] ? (int) $row['source_id'] : null,
                'content'    => (string) $row['content'],
                'status'     => (string) $row['status'],
                'createdAt'  => (string) $row['created_at'],
                'updatedAt'  => (string) $row['updated_at'],
            );
        }
        return $out;
    }

    /**
     * Re-chunk and embed a single document.
     *
     * @return true|\WP_Error
     */
    public function reindex_document( int $document_id ) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $doc = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}kmbp_kb_documents WHERE id = %d",
                $document_id
            ),
            ARRAY_A
        );
        if ( ! $doc ) {
            return new WP_Error( 'kmbp_kb_missing', __( 'Document not found.', 'kinetix-messaging-by-ppros' ) );
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $wpdb->delete( $wpdb->prefix . 'kmbp_kb_chunks', array( 'document_id' => $document_id ), array( '%d' ) );

        $plain  = wp_strip_all_tags( (string) $doc['content'] );
        $chunks = $this->chunk_text( $plain );
        if ( empty( $chunks ) ) {
            return true;
        }

        if ( ! $this->client->is_configured() || ! $this->client->supports_embeddings() ) {
            // Store chunks without embeddings so keyword search still works
            // (Claude/Grok have no embedding API).
            foreach ( $chunks as $i => $chunk ) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->insert(
                    $wpdb->prefix . 'kmbp_kb_chunks',
                    array(
                        'document_id' => $document_id,
                        'chunk_index' => $i,
                        'content'     => $chunk,
                        'embedding'   => null,
                    ),
                    array( '%d', '%d', '%s', null )
                );
            }
            return true;
        }

        $embeddings = $this->client->embed( $chunks );
        if ( is_wp_error( $embeddings ) ) {
            return $embeddings;
        }

        foreach ( $chunks as $i => $chunk ) {
            $vec = isset( $embeddings[ $i ] ) ? $embeddings[ $i ] : array();
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->insert(
                $wpdb->prefix . 'kmbp_kb_chunks',
                array(
                    'document_id' => $document_id,
                    'chunk_index' => $i,
                    'content'     => $chunk,
                    'embedding'   => ! empty( $vec ) ? wp_json_encode( $vec ) : null,
                ),
                array( '%d', '%d', '%s', '%s' )
            );
        }
        return true;
    }

    /**
     * Index or refresh published posts/pages into the KB.
     *
     * @param int $limit Max posts to process.
     * @return array{indexed:int,errors:int}
     */
    public function index_wp_content( int $limit = 100 ): array {
        $posts = get_posts(
            array(
                'post_type'      => array( 'post', 'page' ),
                'post_status'    => 'publish',
                'posts_per_page' => $limit,
                'orderby'        => 'modified',
                'order'          => 'DESC',
            )
        );

        $indexed = 0;
        $errors  = 0;
        foreach ( $posts as $post ) {
            $result = $this->upsert_wp_post( $post );
            if ( is_wp_error( $result ) ) {
                ++$errors;
            } else {
                ++$indexed;
            }
        }
        return array( 'indexed' => $indexed, 'errors' => $errors );
    }

    /**
     * Upsert a WP post/page into the KB.
     *
     * @param \WP_Post $post
     * @return int|\WP_Error
     */
    public function upsert_wp_post( $post ) {
        global $wpdb;
        if ( ! $post || ! in_array( $post->post_status, array( 'publish' ), true ) ) {
            return new WP_Error( 'kmbp_kb_skip', 'Not published' );
        }

        $source_type = 'page' === $post->post_type ? 'page' : 'post';
        $content     = $post->post_title . "\n\n" . wp_strip_all_tags( $post->post_content );
        $now         = current_time( 'mysql' );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $existing = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM {$wpdb->prefix}kmbp_kb_documents
                 WHERE source_type = %s AND source_id = %d LIMIT 1",
                $source_type,
                (int) $post->ID
            )
        );

        if ( $existing > 0 ) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->update(
                $wpdb->prefix . 'kmbp_kb_documents',
                array(
                    'title'      => sanitize_text_field( $post->post_title ),
                    'content'    => $content,
                    'status'     => 'active',
                    'updated_at' => $now,
                ),
                array( 'id' => $existing ),
                array( '%s', '%s', '%s', '%s' ),
                array( '%d' )
            );
            $doc_id = $existing;
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->insert(
                $wpdb->prefix . 'kmbp_kb_documents',
                array(
                    'title'       => sanitize_text_field( $post->post_title ),
                    'source_type' => $source_type,
                    'source_id'   => (int) $post->ID,
                    'content'     => $content,
                    'status'      => 'active',
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ),
                array( '%s', '%s', '%d', '%s', '%s', '%s', '%s' )
            );
            $doc_id = (int) $wpdb->insert_id;
        }

        $embed = $this->reindex_document( $doc_id );
        if ( is_wp_error( $embed ) ) {
            return $embed;
        }
        return $doc_id;
    }

    /**
     * Remove WP-sourced documents for a post ID.
     */
    public function remove_wp_post( int $post_id ): void {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $ids = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT id FROM {$wpdb->prefix}kmbp_kb_documents
                 WHERE source_id = %d AND source_type IN ('post','page')",
                $post_id
            )
        );
        foreach ( (array) $ids as $id ) {
            $this->delete_document( (int) $id );
        }
    }

    /**
     * Retrieve top-k chunks for a query.
     *
     * @return array List of {content, score, documentId}.
     */
    public function search( string $query, int $top_k = self::TOP_K ): array {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $rows = $wpdb->get_results(
            "SELECT c.id, c.document_id, c.content, c.embedding
             FROM {$wpdb->prefix}kmbp_kb_chunks c
             INNER JOIN {$wpdb->prefix}kmbp_kb_documents d ON d.id = c.document_id
             WHERE d.status = 'active'",
            ARRAY_A
        );
        if ( empty( $rows ) ) {
            return array();
        }

        $query_vec = null;
        if ( $this->client->is_configured() && $this->client->supports_embeddings() ) {
            $emb = $this->client->embed( $query );
            if ( ! is_wp_error( $emb ) && ! empty( $emb[0] ) ) {
                $query_vec = $emb[0];
            }
        }

        $scored = array();
        foreach ( (array) $rows as $row ) {
            $score = 0.0;
            $vec   = json_decode( (string) $row['embedding'], true );
            if ( $query_vec && is_array( $vec ) && ! empty( $vec ) ) {
                $score = $this->cosine_similarity( $query_vec, array_map( 'floatval', $vec ) );
            } else {
                // Fallback keyword overlap.
                $score = $this->keyword_score( $query, (string) $row['content'] );
            }
            $scored[] = array(
                'content'    => (string) $row['content'],
                'score'      => $score,
                'documentId' => (int) $row['document_id'],
            );
        }

        usort(
            $scored,
            static function ( $a, $b ) {
                return $b['score'] <=> $a['score'];
            }
        );

        return array_slice( $scored, 0, max( 1, $top_k ) );
    }

    /**
     * Answer a user question using retrieved context.
     *
     * @param string $question
     * @param array  $history  Recent {role, content} turns.
     * @return string|\WP_Error
     */
    public function answer( string $question, array $history = array() ) {
        $hits    = $this->search( $question );
        $context = '';
        foreach ( $hits as $i => $hit ) {
            if ( ( $hit['score'] ?? 0 ) <= 0 && $i > 0 ) {
                continue;
            }
            $context .= "\n[Source " . ( $i + 1 ) . "]\n" . $hit['content'] . "\n";
        }

        if ( '' === trim( $context ) ) {
            $context = '(No knowledge base articles matched.)';
        }

        $system = "You are a helpful customer support assistant. Answer ONLY using the knowledge base context below. "
            . "If the answer is not in the context, say you do not have that information and offer to connect the user with a human agent. "
            . "Keep replies concise and friendly. Do not invent facts.\n\nKnowledge base:\n" . $context;

        $messages = array( array( 'role' => 'system', 'content' => $system ) );
        foreach ( array_slice( $history, -8 ) as $turn ) {
            if ( empty( $turn['role'] ) || empty( $turn['content'] ) ) {
                continue;
            }
            $messages[] = array(
                'role'    => 'assistant' === $turn['role'] ? 'assistant' : 'user',
                'content' => (string) $turn['content'],
            );
        }
        $messages[] = array( 'role' => 'user', 'content' => $question );

        if ( ! $this->client->is_configured() ) {
            if ( ! empty( $hits ) && ( $hits[0]['score'] ?? 0 ) > 0 ) {
                return wp_trim_words( $hits[0]['content'], 80, '…' );
            }
            return __( "I don't have an answer for that yet. Say \"talk to a human\" to reach an agent.", 'kinetix-messaging-by-ppros' );
        }

        return $this->client->chat( $messages, array( 'temperature' => 0.2 ) );
    }

    /**
     * Split text into overlapping chunks.
     *
     * @return string[]
     */
    public function chunk_text( string $text ): array {
        $text = preg_replace( '/\s+/u', ' ', trim( $text ) );
        if ( '' === $text ) {
            return array();
        }
        $len = mb_strlen( $text );
        if ( $len <= self::CHUNK_SIZE ) {
            return array( $text );
        }

        $chunks = array();
        $start  = 0;
        while ( $start < $len ) {
            $chunk    = mb_substr( $text, $start, self::CHUNK_SIZE );
            $chunks[] = $chunk;
            $start   += self::CHUNK_SIZE - self::CHUNK_OVERLAP;
            if ( $start + self::CHUNK_OVERLAP >= $len ) {
                break;
            }
        }
        return $chunks;
    }

    /**
     * @param float[] $a
     * @param float[] $b
     */
    private function cosine_similarity( array $a, array $b ): float {
        $n = min( count( $a ), count( $b ) );
        if ( $n <= 0 ) {
            return 0.0;
        }
        $dot = 0.0;
        $na  = 0.0;
        $nb  = 0.0;
        for ( $i = 0; $i < $n; $i++ ) {
            $dot += $a[ $i ] * $b[ $i ];
            $na  += $a[ $i ] * $a[ $i ];
            $nb  += $b[ $i ] * $b[ $i ];
        }
        if ( $na <= 0.0 || $nb <= 0.0 ) {
            return 0.0;
        }
        return $dot / ( sqrt( $na ) * sqrt( $nb ) );
    }

    private function keyword_score( string $query, string $content ): float {
        $q_words = preg_split( '/\W+/u', strtolower( $query ), -1, PREG_SPLIT_NO_EMPTY );
        if ( empty( $q_words ) ) {
            return 0.0;
        }
        $hay   = strtolower( $content );
        $hits  = 0;
        foreach ( array_unique( $q_words ) as $w ) {
            if ( strlen( $w ) < 3 ) {
                continue;
            }
            if ( false !== strpos( $hay, $w ) ) {
                ++$hits;
            }
        }
        return $hits / max( 1, count( array_unique( $q_words ) ) );
    }
}
