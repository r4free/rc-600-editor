import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LeaveEditorGuard } from "./components/LeaveEditorGuard";
import { SupportNoticeModal } from "./components/SupportNoticeModal";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LeaveEditorGuard />
    <App />
    <SupportNoticeModal />
  </StrictMode>,
);
