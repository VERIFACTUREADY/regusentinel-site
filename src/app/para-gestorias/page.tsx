import { VerticalLanding, verticalMetadata } from "@/components/vertical-landing";

export const metadata = verticalMetadata("gestorias");

export default function Page() {
  return <VerticalLanding slug="gestorias" />;
}
