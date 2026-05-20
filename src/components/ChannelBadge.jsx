import { CHANNELS } from "../constants/config";
const channelMeta = (id) => CHANNELS.find((c) => c.id === id) || CHANNELS[0];
export default function ChannelBadge({ channelId, small }) {
  const ch = channelMeta(channelId);
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: small ? 11 : 12, fontWeight: 500, color: ch.color || "#6b7280", background: (ch.color || "#6b7280") + "18", borderRadius: 20, padding: small ? "2px 7px" : "3px 9px" }}
    >
      <i className={`ti ${ch.icon}`} style={{ fontSize: small ? 11 : 13 }} />
      {!small && ch.label}
    </span>
  );
}