import { CHANNELS } from "../constants/config";
const channelMeta = (id) => CHANNELS.find((c) => c.id === id) || CHANNELS[0];

/** Renders either a Tabler icon class or a text letter (icon: "letter:XX"). */
function ChannelIcon({ icon, color, size }) {
  if (icon && icon.startsWith("letter:")) {
    const letter = icon.slice(7);
    return (
      <span
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: size, height: size, borderRadius: "50%",
          background: color, color: "#fff",
          fontSize: Math.round(size * 0.6), fontWeight: 800, lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {letter}
      </span>
    );
  }
  return <i className={`ti ${icon}`} style={{ fontSize: size }} />;
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