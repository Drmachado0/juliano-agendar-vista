import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installDataLayerDebug } from "./lib/dataLayerDebug";
import { captureAttribution } from "./lib/tracking";

installDataLayerDebug();
// Captura UTMs/click-ids/landing_page/referrer/event_id na entrada do site,
// antes de qualquer interação, para atribuição de mídia paga no CRM.
captureAttribution();

createRoot(document.getElementById("root")!).render(<App />);
