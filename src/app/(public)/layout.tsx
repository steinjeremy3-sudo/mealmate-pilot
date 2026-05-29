// Layout for the public surface — marketing landing at /, the offer
// browse at /browse, and restaurant detail at /r/[id]. The route
// group "(public)" doesn't appear in the URL.

import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      {children}
      <PublicFooter />
    </>
  );
}
