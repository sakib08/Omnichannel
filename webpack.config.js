/**
 * Extend the default @wordpress/scripts webpack configuration.
 *
 * Changes made:
 *  - Disable performance hints: this plugin runs inside the WP admin UI,
 *    not on a public page, so the 244 KiB "site performance" threshold
 *    that webpack defaults to is not relevant here.
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	performance: {
		hints: false,
	},
};
