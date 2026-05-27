import { render, StrictMode } from "@wordpress/element";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "./index.css";
import App from "./App.jsx";

render(
  <StrictMode>
    <App />
  </StrictMode>,
  document.getElementById("synchronized-messaging-engine")
);
