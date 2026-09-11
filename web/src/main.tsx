import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LeaveEditorGuard } from "./components/LeaveEditorGuard";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LeaveEditorGuard />
    <App />
  </StrictMode>,
);
