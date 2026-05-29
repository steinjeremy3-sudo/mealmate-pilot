// Layout for anon-browseable public routes — /browse, /r/[id]. The
// route group "(public)" doesn't appear in the URL.
//
// Marketing pages and auth screens live at sibling roots and use
// their own layouts; this one is just the public-app surface.

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
    </>
  );
}
