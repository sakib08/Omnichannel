import { CHANNELS } from "../constants/config";
export const channelMeta = (id) => CHANNELS.find((c) => c.id === id) || CHANNELS[0];

/**
 * Renders either a Tabler icon class (ti-brand-*) or a styled letter badge
 * (icon: "letter:XX") for platforms without a Tabler brand icon.
 */
const BRAND_PATHS = {
  "ti-brand-whatsapp": "M12 2.2A9.8 9.8 0 0 0 3.7 16.9L2.4 21.6l4.9-1.3A9.8 9.8 0 1 0 12 2.2zm5.5 13.8c-.2.7-1.2 1.2-1.7 1.3-.4.1-1 .1-1.6-.1-.4-.1-.8-.3-1.4-.5-2.5-1.1-4.1-3.6-4.2-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.8 1.9.8 2s.1.3 0 .5l-.3.4c-.1.2-.3.3-.4.5-.1.1-.3.3-.1.5.2.3.7 1.2 1.5 1.9 1.1 1 1.9 1.3 2.2 1.4.3.1.4.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.3.1 1.6.8 1.9.9.3.1.5.2.5.3.1.2.1.7-.1 1.3z",
};

export function ChannelIcon({ icon, color, size }) {
  if (BRAND_PATHS[icon]) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ color, display: "block", flexShrink: 0 }}>
        <path fill="currentColor" fillRule="evenodd" d={BRAND_PATHS[icon]} />
      </svg>
    );
  }
  if (icon && icon.startsWith("letter:")) {
    const letter = icon.slice(7);
    return (
      <span
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: size, height: size, borderRadius: "50%",
          background: color, color: "#fff",
          fontSize: Math.round(size * 0.55), fontWeight: 800, lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {letter}
      </span>
    );
  }
  return <i className={`ti ${icon}`} style={{ fontSize: size, color }} />;
}

export default function ChannelBadge({ channelId, small }) {
  const ch = channelMeta(channelId);
  const iconSize = small ? 11 : 13;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: small ? 11 : 12, fontWeight: 500,
        color: ch.color || "#6b7280",
        background: (ch.color || "#6b7280") + "18",
        borderRadius: 20, padding: small ? "2px 7px" : "3px 9px",
      }}
    >
      <ChannelIcon icon={ch.icon} color={ch.color || "#6b7280"} size={iconSize} />
      {!small && ch.label}
    </span>
  );
}