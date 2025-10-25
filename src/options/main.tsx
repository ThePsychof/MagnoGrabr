import React from "react";
import { createRoot } from "react-dom/client";
import Options from "./Options";
import "../styles/tailwind.css";

const root = createRoot(document.getElementById("root")!);
root.render(<Options />);