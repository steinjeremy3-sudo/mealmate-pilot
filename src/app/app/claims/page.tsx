// The standalone claims list folded into the Wallet tab. This route
// stays as a redirect so older links / bookmarks don't dead-end.
// (Claim detail still lives at /app/claims/[id].)

import { redirect } from "next/navigation";

export default function ClaimsIndex() {
  redirect("/app/wallet");
}
