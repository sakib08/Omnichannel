import { render, StrictMode } from "@wordpress/element";
import "./index.css";
import App from "./App.jsx";

render(
  <StrictMode>
    <App />
  </StrictMode>,
  document.getElementById("synchronized-messaging-engine")
);
