import { Suspense } from "react";
import { LandingClient } from "./landing-client";

export default function Page() {
  return (
    <Suspense>
      <LandingClient />
    </Suspense>
  );
}
