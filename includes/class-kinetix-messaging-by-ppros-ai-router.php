<?php
/**
 * Agent / department routing helpers for the AI assistant.
 *
 * @package Kinetix_Messaging_By_Ppros
 */

defined( 'ABSPATH' ) || die( 'No script kiddies please!' );

class Kinetix_Messaging_By_Ppros_Ai_Router {

    /**
     * List departments as id/name/slug arrays.
     *
     * @return array
     */
    public function list_departments(): array {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $rows = $wpdb->get_results(
            "SELECT id, name, slug, description FROM {$wpdb->prefix}kmbp_departments ORDER BY name ASC",
            ARRAY_A
        );
        $out = array();
        foreach ( (array) $rows as $row ) {
            $out[] = array(
                'id'          => (int) $row['id'],
                'name'        => (string) $row['name'],
                'slug'        => (string) $row['slug'],
                'description' => (string) ( $row['description'] ?? '' ),
            );
        }
        return $out;
    }

    /**
     * Find department by slug (case-insensitive) or name.
     *
     * @param string $slug_or_name
     * @return array|null
     */
    public function find_department( string $slug_or_name ) {
        $needle = strtolower( trim( $slug_or_name ) );
        if ( '' === $needle ) {
            return null;
        }
        foreach ( $this->list_departments() as $dept ) {
            if ( strtolower( $dept['slug'] ) === $needle || strtolower( $dept['name'] ) === $needle ) {
                return $dept;
            }
        }
        return null;
    }

    /**
     * Agents mapped to a department (kmbp_agent or administrator).
     * Sorted by fewest open assigned conversations first.
     *
     * @param int $department_id
     * @return int[] User IDs.
     */
    public function find_available_agents( int $department_id ): array {
        global $wpdb;
        if ( $department_id <= 0 ) {
            return array();
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $user_ids = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT user_id FROM {$wpdb->prefix}kmbp_agent_departments WHERE department_id = %d",
                $department_id
            )
        );
        $user_ids = array_values( array_unique( array_map( 'intval', (array) $user_ids ) ) );
        if ( empty( $user_ids ) ) {
            return array();
        }

        $eligible = array();
        foreach ( $user_ids as $uid ) {
            $user = get_userdata( $uid );
            if ( ! $user ) {
                continue;
            }
            $roles = (array) $user->roles;
            if ( in_array( Kinetix_Messaging_By_Ppros_Activator::AGENT_ROLE, $roles, true )
                || in_array( 'administrator', $roles, true ) ) {
                $eligible[] = $uid;
            }
        }

        return $this->sort_by_load( $eligible );
    }

    /**
     * Whether any agent is mapped to any department.
     */
    public function has_any_mapped_agents(): bool {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}kmbp_agent_departments" );
        return $count > 0;
    }

    /**
     * First administrator user ID (for fallback assignment).
     *
     * @return int
     */
    public function get_fallback_admin_id(): int {
        $admins = get_users(
            array(
                'role'    => 'administrator',
                'orderby' => 'ID',
                'order'   => 'ASC',
                'number'  => 1,
                'fields'  => array( 'ID' ),
            )
        );
        if ( ! empty( $admins ) ) {
            return (int) $admins[0]->ID;
        }
        return 0;
    }

    /**
     * Pick least-loaded agent from a list.
     *
     * @param int[] $user_ids
     * @return int
     */
    public function pick_least_loaded( array $user_ids ): int {
        $sorted = $this->sort_by_load( $user_ids );
        return ! empty( $sorted ) ? (int) $sorted[0] : 0;
    }

    /**
     * @param int[] $user_ids
     * @return int[]
     */
    private function sort_by_load( array $user_ids ): array {
        global $wpdb;
        if ( empty( $user_ids ) ) {
            return array();
        }

        $loads = array();
        foreach ( $user_ids as $uid ) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $open = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}kmbp_conversations
                     WHERE assignee_id = %d AND status NOT IN ('closed','resolved')",
                    $uid
                )
            );
            $loads[ $uid ] = $open;
        }

        asort( $loads, SORT_NUMERIC );
        return array_map( 'intval', array_keys( $loads ) );
    }
}
