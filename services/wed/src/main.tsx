import React from "react";
import ReactDOM from "react-dom/client";
import { createLightTheme, FluentProvider } from "@fluentui/react-components";
import App from "./App";
import "./styles.css";

const communityTheme = createLightTheme({
  10: "#123c49",
  20: "#15515b",
  30: "#176771",
  40: "#197d83",
  50: "#208f91",
  60: "#35a09d",
  70: "#52b0a8",
  80: "#70c0b3",
  90: "#8bcfbe",
  100: "#a5ddc9",
  110: "#bde8d5",
  120: "#d0efdf",
  130: "#def4e8",
  140: "#eaf8f0",
  150: "#f3fbf7",
  160: "#f9fdfb"
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FluentProvider theme={communityTheme}>
      <App />
    </FluentProvider>
  </React.StrictMode>
);
