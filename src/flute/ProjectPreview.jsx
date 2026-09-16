"use client";
import React from "react";
import { ProjectPreview } from "@webprodigies/flute/preview";
import { sceneModules } from "./catalog";
// Host-owned development flag: no process, Vite or Electron globals in this adapter.
export function FluteProjectPreview({ children, enabled, active, ...props }) {
  if (!enabled) return children;
  return <ProjectPreview {...props} projectId="a23d4ca7-48d0-4a29-bda3-3d05186e690c" enabled={enabled} active={active} sceneModules={sceneModules}>{children}</ProjectPreview>;
}
