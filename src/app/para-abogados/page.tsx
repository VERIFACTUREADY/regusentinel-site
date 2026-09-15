import { VerticalLanding, verticalMetadata } from "@/components/vertical-landing";

export const metadata = verticalMetadata("abogados");

export default function Page() {
  return <VerticalLanding slug="abogados" />;
}
