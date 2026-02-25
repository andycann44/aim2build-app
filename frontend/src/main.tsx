// FILE: src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AppGate from "./components/AppGate";
import { installAuthFetchGuard } from "./utils/authFetch";
import "./index.css";

installAuthFetchGuard();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <BrowserRouter>
    <AppGate>
      <App />
    </AppGate>
  </BrowserRouter>
);