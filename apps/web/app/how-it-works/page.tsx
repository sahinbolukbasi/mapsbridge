import { routeMetadata } from "../lib/site-metadata";
import { HowItWorksClient } from "./how-it-works-client";

export const metadata = routeMetadata("/how-it-works/");

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}
