<?php
/**
 * RAG knowledge base: chunk, embed, search, and answer.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Ai_Rag {

    const CHUNK_SIZE       = 700;
    const CHUNK_OVERLAP    = 100;
    const TOP_K            = 5;
    const MAX_UPLOAD_FILES = 20;
    const MAX_UPLOAD_BYTES = 8388608;
    const MAX_UPLOAD_CHARS = 80000;

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

    /**
     * Index uploaded knowledge-base files. One article per file.
     *
     * @param array<int,array{name:string,type:string,tmp_name:string,error:int,size:int}> $files
     * @return array{added:array<int,array<string,mixed>>,errors:array<int,array{name:string,message:string}>}
     */
    public function import_uploaded_files( array $files ): array {
        $added  = array();
        $errors = array();
        $count  = 0;
        foreach ( $files as $file ) {
            $name = sanitize_file_name( (string) ( $file['name'] ?? '' ) );
            if ( '' === $name ) {
                $name = 'file';
            }
            if ( $count >= self::MAX_UPLOAD_FILES ) {
                $errors[] = array(
                    'name'    => $name,
                    'message' => __( 'You can upload up to 20 files at a time.', 'kinetix-messaging-by-ppros' ),
                );
                continue;
            }
            ++$count;

            $text = $this->text_from_upload( $file );
            if ( is_wp_error( $text ) ) {
                $errors[] = array(
                    'name'    => $name,
                    'message' => $text->get_error_message(),
                );
                continue;
            }

            $doc_id = $this->upsert_manual_document( $this->title_from_filename( $name ), $text );
            if ( is_wp_error( $doc_id ) ) {
                $errors[] = array(
                    'name'    => $name,
                    'message' => $doc_id->get_error_message(),
                );
                continue;
            }
            $added[] = array(
                'id'    => (int) $doc_id,
                'title' => $this->title_from_filename( $name ),
                'name'  => $name,
            );
        }

        return array(
            'added'  => $added,
            'errors' => $errors,
        );
    }

    /**
     * Read plain text from one uploaded file.
     *
     * @param array{name?:string,tmp_name?:string,error?:int,size?:int} $file
     * @return string|\WP_Error
     */
    public function text_from_upload( array $file ) {
        $name = sanitize_file_name( (string) ( $file['name'] ?? '' ) );
        $tmp  = (string) ( $file['tmp_name'] ?? '' );
        $err  = (int) ( $file['error'] ?? UPLOAD_ERR_NO_FILE );
        $size = (int) ( $file['size'] ?? 0 );

        if ( UPLOAD_ERR_OK !== $err ) {
            return new WP_Error( 'kmbp_kb_upload', $this->upload_error_message( $err ) );
        }
        if ( '' === $tmp || ! is_uploaded_file( $tmp ) ) {
            return new WP_Error( 'kmbp_kb_upload', __( 'Choose a file to upload.', 'kinetix-messaging-by-ppros' ) );
        }

        $max = self::MAX_UPLOAD_BYTES;
        if ( function_exists( 'wp_max_upload_size' ) ) {
            $max = (int) min( $max, wp_max_upload_size() );
        }
        if ( $size <= 0 || $size > $max ) {
            return new WP_Error(
                'kmbp_kb_upload',
                sprintf(
                    /* translators: %s: maximum file size, such as 8 MB. */
                    __( 'Each file must be under %s.', 'kinetix-messaging-by-ppros' ),
                    size_format( $max )
                )
            );
        }

        $ext = strtolower( (string) pathinfo( $name, PATHINFO_EXTENSION ) );
        if ( ! isset( $this->kb_file_types()[ $ext ] ) ) {
            return new WP_Error(
                'kmbp_kb_upload',
                __( 'Upload a text, Markdown, CSV, HTML, JSON, RTF, DOCX, or PDF file.', 'kinetix-messaging-by-ppros' )
            );
        }

        $mime = '';
        if ( function_exists( 'finfo_open' ) ) {
            $finfo = finfo_open( FILEINFO_MIME_TYPE );
            if ( $finfo ) {
                $detected = finfo_file( $finfo, $tmp );
                finfo_close( $finfo );
                $mime = is_string( $detected ) ? $detected : '';
            }
        }
        $allowed = $this->kb_file_types()[ $ext ];
        if ( '' !== $mime && ! in_array( $mime, $allowed, true ) ) {
            return new WP_Error(
                'kmbp_kb_upload',
                __( 'That file does not look like the selected document type.', 'kinetix-messaging-by-ppros' )
            );
        }

        return $this->text_from_path( $tmp, $ext );
    }

    /**
     * Extract UTF-8 text from a local document.
     *
     * @param string $path Absolute path.
     * @param string $ext  Lowercase extension.
     * @return string|\WP_Error
     */
    public function text_from_path( string $path, string $ext ) {
        if ( 'pdf' === $ext ) {
            $text = $this->extract_pdf_text( $path );
        } elseif ( 'docx' === $ext ) {
            $text = $this->extract_docx_text( $path );
        } else {
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local upload, size already capped.
            $raw = file_get_contents( $path );
            if ( ! is_string( $raw ) ) {
                return new WP_Error( 'kmbp_kb_upload', __( 'Could not read that file.', 'kinetix-messaging-by-ppros' ) );
            }
            $utf16 = strncmp( $raw, "\xFF\xFE", 2 ) === 0 || strncmp( $raw, "\xFE\xFF", 2 ) === 0;
            if ( ! $utf16 && false !== strpos( substr( $raw, 0, 4096 ), "\0" ) ) {
                return new WP_Error( 'kmbp_kb_upload', __( 'That file does not look like the selected document type.', 'kinetix-messaging-by-ppros' ) );
            }
            $text = $this->normalize_document_text( $raw, $ext );
        }

        if ( is_wp_error( $text ) ) {
            return $text;
        }
        $text = trim( (string) $text );
        if ( '' === $text ) {
            return new WP_Error( 'kmbp_kb_upload', __( 'That file has no extractable text.', 'kinetix-messaging-by-ppros' ) );
        }
        if ( mb_strlen( $text ) > self::MAX_UPLOAD_CHARS ) {
            $text = mb_substr( $text, 0, self::MAX_UPLOAD_CHARS );
        }
        return $text;
    }

    /**
     * @return array<string,string[]>
     */
    private function kb_file_types(): array {
        $text = array( 'text/plain', 'application/octet-stream' );
        return array(
            'txt'      => $text,
            'md'       => array_merge( $text, array( 'text/markdown', 'text/x-markdown' ) ),
            'markdown' => array_merge( $text, array( 'text/markdown', 'text/x-markdown' ) ),
            'csv'      => array_merge( $text, array( 'text/csv', 'application/csv', 'application/vnd.ms-excel' ) ),
            'tsv'      => array_merge( $text, array( 'text/tab-separated-values' ) ),
            'json'     => array_merge( $text, array( 'application/json', 'text/json' ) ),
            'html'     => array_merge( $text, array( 'text/html' ) ),
            'htm'      => array_merge( $text, array( 'text/html' ) ),
            'xml'      => array_merge( $text, array( 'application/xml', 'text/xml' ) ),
            'log'      => $text,
            'rtf'      => array_merge( $text, array( 'application/rtf', 'text/rtf' ) ),
            'docx'     => array(
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/zip',
                'application/octet-stream',
            ),
            'pdf'      => array( 'application/pdf', 'application/octet-stream' ),
        );
    }

    private function title_from_filename( string $name ): string {
        $base  = (string) pathinfo( $name, PATHINFO_FILENAME );
        $title = trim( str_replace( array( '_', '-' ), ' ', $base ) );
        $title = sanitize_text_field( $title );
        if ( '' === $title ) {
            $title = __( 'Uploaded document', 'kinetix-messaging-by-ppros' );
        }
        if ( mb_strlen( $title ) > 180 ) {
            $title = mb_substr( $title, 0, 180 );
        }
        return $title;
    }

    /**
     * @param string $raw
     * @param string $ext
     */
    private function normalize_document_text( string $raw, string $ext ): string {
        if ( strncmp( $raw, "\xFF\xFE", 2 ) === 0 || strncmp( $raw, "\xFE\xFF", 2 ) === 0 ) {
            $raw = mb_convert_encoding( $raw, 'UTF-8', 'UTF-16' );
        }
        $raw = preg_replace( '/^\xEF\xBB\xBF/', '', $raw );
        if ( function_exists( 'wp_check_invalid_utf8' ) ) {
            $raw = (string) wp_check_invalid_utf8( $raw, true );
        }

        if ( in_array( $ext, array( 'html', 'htm', 'xml' ), true ) ) {
            $raw = preg_replace( '/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)\b[^>]*>/i', "\n", $raw );
            $raw = wp_strip_all_tags( (string) $raw );
            $raw = html_entity_decode( $raw, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
        } elseif ( 'rtf' === $ext ) {
            $raw = preg_replace( '/\\\\[a-z]+-?\d* ?/i', '', $raw );
            $raw = str_replace( array( '{', '}' ), '', (string) $raw );
        } elseif ( 'json' === $ext ) {
            $decoded = json_decode( $raw, true );
            if ( null !== $decoded ) {
                $pretty = wp_json_encode( $decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE );
                if ( is_string( $pretty ) ) {
                    $raw = $pretty;
                }
            }
        }

        $raw = str_replace( array( "\r\n", "\r" ), "\n", $raw );
        return trim( (string) preg_replace( "/\n{3,}/", "\n\n", $raw ) );
    }

    /**
     * @return string|\WP_Error
     */
    private function extract_docx_text( string $path ) {
        $xml = $this->zip_entry( $path, 'word/document.xml' );
        if ( ! is_string( $xml ) || '' === $xml ) {
            return new WP_Error( 'kmbp_kb_docx', __( 'Could not read that DOCX file.', 'kinetix-messaging-by-ppros' ) );
        }
        $xml = str_replace( array( '</w:p>', '</w:tr>' ), "\n", $xml );
        $xml = preg_replace( '/<w:tab[^>]*\/>/', "\t", $xml );
        $text = $this->normalize_document_text( wp_strip_all_tags( (string) $xml ), 'txt' );
        if ( '' === trim( $text ) ) {
            return new WP_Error( 'kmbp_kb_docx', __( 'That DOCX file has no document text.', 'kinetix-messaging-by-ppros' ) );
        }
        return $text;
    }

    /**
     * Read one stored or deflated entry from a zip file without the Zip extension.
     *
     * @return string|false
     */
    private function zip_entry( string $path, string $wanted ) {
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local upload, size already capped.
        $raw = file_get_contents( $path );
        if ( ! is_string( $raw ) || strlen( $raw ) < 22 ) {
            return false;
        }
        $eocd = strrpos( $raw, "PK\x05\x06" );
        if ( false === $eocd ) {
            return false;
        }
        $cd_off = unpack( 'V', substr( $raw, $eocd + 16, 4 ) );
        if ( ! is_array( $cd_off ) ) {
            return false;
        }
        $pos = (int) $cd_off[1];
        $len = strlen( $raw );
        while ( $pos + 46 <= $len && "PK\x01\x02" === substr( $raw, $pos, 4 ) ) {
            $method      = unpack( 'v', substr( $raw, $pos + 10, 2 ) );
            $comp_size   = unpack( 'V', substr( $raw, $pos + 20, 4 ) );
            $name_len    = unpack( 'v', substr( $raw, $pos + 28, 2 ) );
            $extra_len   = unpack( 'v', substr( $raw, $pos + 30, 2 ) );
            $comment_len = unpack( 'v', substr( $raw, $pos + 32, 2 ) );
            $local_off   = unpack( 'V', substr( $raw, $pos + 42, 4 ) );
            if ( ! is_array( $method ) || ! is_array( $name_len ) || ! is_array( $comp_size ) || ! is_array( $extra_len ) || ! is_array( $comment_len ) || ! is_array( $local_off ) ) {
                return false;
            }
            $name = substr( $raw, $pos + 46, (int) $name_len[1] );
            if ( $name === $wanted ) {
                $local = (int) $local_off[1];
                if ( $local + 30 > $len || "PK\x03\x04" !== substr( $raw, $local, 4 ) ) {
                    return false;
                }
                $local_name  = unpack( 'v', substr( $raw, $local + 26, 2 ) );
                $local_extra = unpack( 'v', substr( $raw, $local + 28, 2 ) );
                if ( ! is_array( $local_name ) || ! is_array( $local_extra ) ) {
                    return false;
                }
                $data_off = $local + 30 + (int) $local_name[1] + (int) $local_extra[1];
                $data     = substr( $raw, $data_off, (int) $comp_size[1] );
                if ( 0 === (int) $method[1] ) {
                    return $data;
                }
                if ( 8 === (int) $method[1] ) {
                    // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- corrupt deflate streams return false.
                    $out = @gzinflate( $data );
                    return is_string( $out ) ? $out : false;
                }
                return false;
            }
            $pos += 46 + (int) $name_len[1] + (int) $extra_len[1] + (int) $comment_len[1];
        }
        return false;
    }

    /**
     * Pull visible text from a text-based PDF. Scanned pages have no text layer.
     *
     * @return string|\WP_Error
     */
    private function extract_pdf_text( string $path ) {
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local upload, size already capped.
        $raw = file_get_contents( $path );
        if ( ! is_string( $raw ) || strncmp( $raw, '%PDF', 4 ) !== 0 ) {
            return new WP_Error( 'kmbp_kb_pdf', __( 'That PDF could not be read.', 'kinetix-messaging-by-ppros' ) );
        }

        $pieces = array();
        if ( preg_match_all( '/stream\r?\n(.*?)\r?\nendstream/s', $raw, $matches ) ) {
            foreach ( $matches[1] as $stream ) {
                $pieces[] = $this->pdf_stream_to_text( $this->decode_pdf_stream( $stream ) );
            }
        }
        $text = trim( implode( "\n", $pieces ) );
        if ( '' === $text ) {
            $text = trim( $this->pdf_stream_to_text( $raw ) );
        }
        if ( '' === $text ) {
            return new WP_Error(
                'kmbp_kb_pdf',
                __( 'This PDF has no extractable text. Scanned pages need a text layer.', 'kinetix-messaging-by-ppros' )
            );
        }
        return $this->normalize_document_text( $text, 'txt' );
    }

    private function decode_pdf_stream( string $stream ): string {
        $candidates = array( $stream, ltrim( $stream, "\r\n" ) );
        foreach ( $candidates as $candidate ) {
            // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- invalid streams are not compressed.
            $out = @gzuncompress( $candidate );
            if ( is_string( $out ) && '' !== $out ) {
                return $out;
            }
            // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- invalid streams are not compressed.
            $out = @gzinflate( $candidate );
            if ( is_string( $out ) && '' !== $out ) {
                return $out;
            }
        }
        return $stream;
    }

    private function pdf_stream_to_text( string $data ): string {
        $lines = array();
        if ( preg_match_all( '/\[(.*?)\]\s*TJ/s', $data, $arrays ) ) {
            foreach ( $arrays[1] as $array ) {
                $line = $this->pdf_string_runs( $array );
                if ( '' !== $line ) {
                    $lines[] = $line;
                }
            }
        }
        if ( preg_match_all( '/(\((?:\\\\.|[^\\\\)])*\)|<([0-9A-Fa-f\s]+)>)\s*Tj/s', $data, $hits ) ) {
            foreach ( $hits[1] as $token ) {
                $line = $this->pdf_token_text( $token );
                if ( '' !== $line ) {
                    $lines[] = $line;
                }
            }
        }
        return implode( "\n", $lines );
    }

    private function pdf_string_runs( string $data ): string {
        $line = '';
        if ( preg_match_all( '/\((?:\\\\.|[^\\\\)])*\)|<([0-9A-Fa-f\s]+)>/', $data, $bits ) ) {
            foreach ( $bits[0] as $token ) {
                $line .= $this->pdf_token_text( $token );
            }
        }
        return $line;
    }

    private function pdf_token_text( string $token ): string {
        if ( isset( $token[0] ) && '<' === $token[0] ) {
            $hex = preg_replace( '/[^0-9A-Fa-f]/', '', substr( $token, 1, -1 ) );
            if ( ! is_string( $hex ) || '' === $hex ) {
                return '';
            }
            if ( strlen( $hex ) % 2 === 1 ) {
                $hex .= '0';
            }
            $bin = hex2bin( $hex );
            $text = is_string( $bin ) ? $bin : '';
        } else {
            $text = $this->pdf_unescape_literal( $token );
        }
        if ( strncmp( $text, "\xFE\xFF", 2 ) === 0 ) {
            $text = mb_convert_encoding( substr( $text, 2 ), 'UTF-8', 'UTF-16BE' );
        }
        return $text;
    }

    private function pdf_unescape_literal( string $token ): string {
        $body = substr( $token, 1, -1 );
        $out  = '';
        $len  = strlen( $body );
        for ( $i = 0; $i < $len; $i++ ) {
            if ( '\\' !== $body[ $i ] ) {
                $out .= $body[ $i ];
                continue;
            }
            if ( $i + 1 >= $len ) {
                break;
            }
            $next = $body[ ++$i ];
            if ( 'n' === $next ) {
                $out .= "\n";
            } elseif ( 'r' === $next ) {
                $out .= "\r";
            } elseif ( 't' === $next ) {
                $out .= "\t";
            } elseif ( '(' === $next || ')' === $next || '\\' === $next ) {
                $out .= $next;
            } elseif ( $next >= '0' && $next <= '7' ) {
                $oct = $next;
                for ( $k = 0; $k < 2 && $i + 1 < $len && $body[ $i + 1 ] >= '0' && $body[ $i + 1 ] <= '7'; $k++ ) {
                    $oct .= $body[ ++$i ];
                }
                $out .= chr( octdec( $oct ) );
            } else {
                $out .= $next;
            }
        }
        return $out;
    }

    private function upload_error_message( int $code ): string {
        if ( UPLOAD_ERR_INI_SIZE === $code || UPLOAD_ERR_FORM_SIZE === $code ) {
            return __( 'That file is larger than the server upload limit.', 'kinetix-messaging-by-ppros' );
        }
        if ( UPLOAD_ERR_NO_FILE === $code ) {
            return __( 'Choose a file to upload.', 'kinetix-messaging-by-ppros' );
        }
        return __( 'Could not upload that file.', 'kinetix-messaging-by-ppros' );
    }
}
