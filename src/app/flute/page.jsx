import React from "react";
import { notFound } from "next/navigation";
import FluteStudio from "../../../src/flute/Studio";
export default function FlutePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <><meta name="flute-project" content="a23d4ca7-48d0-4a29-bda3-3d05186e690c" /><FluteStudio /></>;
}
