# Phone (SMS) sign-in setup — Twilio + Supabase

Diners can sign up / sign in with a US mobile number instead of email. The
code is built and live in the app, but **Supabase can't send texts on its
own** — you have to connect an SMS provider. This is a one-time setup.

Recommended provider: **Twilio Verify** (purpose-built for one-time codes;
handles deliverability and most US compliance for you). Plain Twilio
Programmable Messaging also works but needs extra US registration (see
notes at the bottom).

Until this is done, the **Phone** tab on sign-up/sign-in will show but
return an error; **email keeps working** the whole time.

---

## Part 1 — Twilio (≈15 min, mostly waiting on a verification email)

1. Create an account at **twilio.com/try-twilio**. Verify your email and
   your own mobile number when prompted.
2. In the Twilio Console, find your **Account SID** and **Auth Token**
   (on the Console home / "Account Info" panel). Keep these handy — you'll
   paste them into Supabase. Treat the Auth Token like a password.
3. Create a **Verify Service**:
   - Left nav → **Explore Products → Verify** (or search "Verify").
   - **Create new Service**. Name it something like `Mealmate`.
   - Set the channel to **SMS**. Save.
   - Copy the **Service SID** (starts with `VA…`). This is the third value
     Supabase needs.

That's it on Twilio for the Verify path — you do **not** need to buy a
phone number when using Twilio Verify.

> Cost at pilot scale is a few dollars: Twilio Verify is roughly
> $0.05 per successful verification in the US, plus normal SMS fees.
> Effectively pennies for a pilot.

---

## Part 2 — Supabase (≈5 min)

1. Open the **Supabase dashboard** → your Mealmate project.
2. Left nav → **Authentication → Sign In / Providers** (older UI:
   **Authentication → Providers**).
3. Find **Phone** and toggle it **on** ("Enable phone provider").
4. **SMS provider:** choose **Twilio Verify** from the dropdown.
5. Paste in:
   - **Twilio Account SID** — from Part 1, step 2
   - **Twilio Auth Token** — from Part 1, step 2
   - **Twilio Verify Service SID** — the `VA…` from Part 1, step 3
6. Leave **OTP length = 6** (our `/verify-phone` screen expects 6 digits)
   and the default OTP expiry.
7. Make sure **phone sign-ups are allowed** — check
   **Authentication → Settings** and confirm signups aren't disabled and,
   if there's a "Enable phone confirmations / phone signups" toggle, it's
   on.
8. **Save.**

---

## Part 3 — Test it (2 min)

1. Go to **`/sign-up/diner`** on the site (after this branch is deployed).
2. Click the **Phone** tab → enter your First/Last name and your US mobile
   number → **Text me a code**.
3. You should get a text within seconds. Enter the 6-digit code on the
   **Enter your code** screen → you should land in the diner app, signed
   in.
4. Sign out, go to **`/sign-in`**, choose **Phone**, enter the same number,
   and confirm you can sign back in.

If the text never arrives or you get an error, the most common causes are a
mistyped SID/token, the Phone provider not actually toggled on, or (for the
plain-Twilio path) missing US registration — see below.

---

## Notes / gotchas

- **Which numbers work:** US 10-digit mobile numbers only (the app rejects
  anything else before it ever calls Twilio).
- **Deploy:** the app code must be pushed to `main` and deployed for the
  Phone tab to appear in production. The Supabase change above takes effect
  immediately, no deploy needed on that side.
- **If you use plain Twilio (not Verify):** sending SMS to US numbers
  requires **A2P 10DLC** registration (register your brand + a campaign in
  the Twilio Console). It's a small fee and can take a few days to approve.
  This is why **Twilio Verify is recommended** — it avoids most of that.
- **Rate limiting:** we rely on Supabase's built-in OTP rate limits for
  now. If phone signups take off, add app-level per-number/per-IP limits
  (the Upstash item in the launch-prep list) to guard against SMS-pumping
  abuse.
- **Existing email users** are unaffected — email + magic link + password
  all keep working exactly as before.
