// The standalone rebate list folded into the Wallet tab. This route
// stays as a redirect so older links / bookmarks don't dead-end.
// (Rebate detail still lives at /app/rebates/[id]; setup at
// /app/rebates/setup.)

import { redirect } from "next/navigation";

export default function RebatesIndex() {
  redirect("/app/wallet?show=rebates");
}
