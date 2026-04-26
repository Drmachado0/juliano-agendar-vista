import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installDataLayerDebug } from "./lib/dataLayerDebug";

installDataLayerDebug();

createRoot(document.getElementById("root")!).render(<App />);
