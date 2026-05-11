// main.jsx
// The entry point for the React application.
// Vite picks this up via index.html's <script type="module" src="/src/main.jsx">.
//
// Two things happen here:
//   1. Import the global Tailwind CSS (Vite processes this through PostCSS).
//   2. Mount the <App /> component into the #root div in index.html.

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css"; // Tailwind base + components + utilities
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  // StrictMode runs effects twice in development to catch side-effect bugs.
  // It has no effect in production builds.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
