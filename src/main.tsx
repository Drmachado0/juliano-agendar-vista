import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installDataLayerDebug } from "./lib/dataLayerDebug";
import { captureAttribution } from "./lib/tracking";
import { installWhatsappCrmAttributionBridge } from "./lib/whatsappCrmAttribution";

installDataLayerDebug();
// Captura UTMs/click-ids/landing_page/referrer/event_id na entrada do site,
// antes de qualquer interação, para atribuição de mídia paga no CRM.
captureAttribution();
// Decora links de WhatsApp com origem/UTMs mesmo antes do consentimento de cookies,
// para não perder atribuição de leads pagos que clicam sem aceitar o banner LGPD.
installWhatsappCrmAttributionBridge();

createRoot(document.getElementById("root")!).render(<App />);
