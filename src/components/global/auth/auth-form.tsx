/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: AuthForm, AuthFormProps, GoogleOnlyForm,
 *   EMAIL_AUTH_ENABLED, GOOGLE_AUTH_ENABLED, authClient, signInSchema,
 *   signUpSchema, GoogleGlyph, PaperButton, PaperLabel, MARKETING_AUTH_COPY,
 *   MARKETING_AUTH_ASSURANCES, AuthAssurances, AuthError, paper design
 *
 * WHAT:  Reusable email+password+Google auth surface. `AuthForm` is a thin
 *        dispatcher that mounts a concrete RHF form per mode (sign-in or
 *        sign-up), or the Google-only panel when email auth is switched off.
 *        The layout is the paper design's form column: a blue mono kicker, a
 *        title, a grey description, the error slot, the action, then the three
 *        numbered assurance lines.
 * WHY:   CLAUDE.md mandates zod + react-hook-form for every input surface, so
 *        both forms resolve against the shared schemas in src/lib/types. Two
 *        concrete forms (not one generic) give exact RHF `Path<>` inference
 *        without `any`.
 *
 *        The EMAIL_AUTH_ENABLED branch sits in the dispatcher rather than
 *        inside each form so the email forms — and their RHF/zod hooks — never
 *        mount at all in Google-only mode.
 *
 *        This was a VISUAL replacement, not a rewrite: every handler, schema,
 *        redirect and error path below is unchanged. What changed is that the
 *        Google button and the error alert now render through the paper design
 *        system, and that rule 4 (one blue per screen) decides which control
 *        gets the saturated fill — in Google-only mode that is the Google
 *        button, and with email enabled it is the submit, so Google steps down
 *        to the outline variant rather than the page carrying two blues.
 * WHERE: Mounted by src/app/(auth)/sign-in|sign-up/page.tsx inside AuthShell;
 *        talks to authClient (src/lib/better-auth/auth-client.ts); schemas live
 *        in src/lib/types/auth.ts; flags live in src/lib/config/auth-methods.ts.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/better-auth/auth-client";
import {
  AUTH_ROUTES,
  EMAIL_AUTH_ENABLED,
  GOOGLE_AUTH_ENABLED,
  MARKETING_AUTH_ASSURANCES,
  MARKETING_AUTH_COPY,
  ROUTES,
} from "@/lib/config";
import { PaperLabel, PaperButton } from "@/components/global/paper";
import { useDevEmailToast } from "@/hooks/use-dev-email-toast";
import {
  signInSchema,
  signUpSchema,
  type AuthFormMode,
  type SignInValues,
  type SignUpValues,
} from "@/lib/types";

/**
 * SOURCE OF TRUTH KEYWORDS: AuthFormProps
 *
 * WHAT:  Props for AuthForm — mode + optional post-success callback URL
 *        (defaults to ROUTES.dashboard).
 * WHY:   The default used to be "/", which was an auth probe that forwarded on
 *        to the dashboard. "/" is now the public landing page, so defaulting
 *        there would drop a user who just signed in back onto the sales copy.
 *        Targeting the dashboard directly is also one redirect shorter; the
 *        dashboard layout still owns the no-org → onboarding hop.
 * WHERE: Used by the (auth) route pages.
 */
export interface AuthFormProps {
  mode: AuthFormMode;
  callbackURL?: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: AuthForm
 *
 * WHAT:  Selects the concrete surface — the Google-only panel when email auth
 *        is switched off, otherwise the RHF form for `mode`.
 * WHERE: Rendered by sign-in/page.tsx and sign-up/page.tsx.
 */
export function AuthForm({
  mode,
  callbackURL = ROUTES.dashboard,
}: AuthFormProps) {
  if (!EMAIL_AUTH_ENABLED)
    return <GoogleOnlyForm callbackURL={callbackURL} />;

  return mode === "sign-in" ? (
    <SignInForm callbackURL={callbackURL} />
  ) : (
    <SignUpForm callbackURL={callbackURL} />
  );
}

/* ---------- Sign-in ---------- */

function SignInForm({ callbackURL }: { callbackURL: string }) {
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });
  const { error, setError, google } = useAuthEffects();
  const isSubmitting = form.formState.isSubmitting;
  const isBusy = isSubmitting || google.isPending;

  async function onSubmit(values: SignInValues) {
    setError(null);
    const { error: authError } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (authError) {
      setError(
        authError.message ??
          "Could not sign in. Check your details and try again.",
      );
      return;
    }
    window.location.assign(callbackURL);
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <AuthHeading mode="sign-in" method="email" />

      <div className="flex flex-col gap-[18px]">
        <AuthError error={error} />
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="m@example.com"
                      disabled={isBusy}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href={AUTH_ROUTES.forgotPassword}
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      disabled={isBusy}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AuthSubmit
              label="Sign in"
              isSubmitting={isSubmitting}
              isBusy={isBusy}
            />
            <GoogleButton
              label="Continue with Google"
              onClick={() => google.run(callbackURL, setError)}
              isPending={google.isPending}
              isBusy={isBusy}
            />
          </form>
        </Form>

        <AuthAssurances mode="sign-in" />
      </div>

      <AuthFooter
        prompt="Don't have an account?"
        ctaLabel="Sign up"
        ctaHref={AUTH_ROUTES.signUp}
      />
    </div>
  );
}

/* ---------- Sign-up ---------- */

function SignUpForm({ callbackURL }: { callbackURL: string }) {
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(
    null,
  );
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onTouched",
  });
  const { error, setError, google } = useAuthEffects();
  const notifyDevEmail = useDevEmailToast();
  const router = useRouter();
  const isSubmitting = form.formState.isSubmitting;
  const isBusy = isSubmitting || google.isPending;

  async function onSubmit(values: SignUpValues) {
    setError(null);
    const { data, error: authError } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    if (authError) {
      setError(
        authError.message ?? "Could not create your account. Try again.",
      );
      return;
    }

    /* Dev-only: if Resend isn't configured, surface the verification link in a
     * toast (no-op otherwise). Awaited so the toast is mounted before we
     * navigate — a client-side push preserves it, a full reload would not. */
    await notifyDevEmail(values.email);

    /* A non-null token means Better Auth signed the user straight in, i.e.
     * requireEmailVerification is off (the dev email fallback). Go to the app
     * instead of dead-ending on a screen waiting for mail that can't arrive.
     * With verification enforced the token is null → check-your-email screen. */
    if (data?.token) {
      router.push(callbackURL);
      router.refresh();
      return;
    }
    setSubmittedEmail(values.email);
  }

  if (submittedEmail) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex size-12 items-center justify-center border border-ink">
          <MailCheckIcon aria-hidden="true" className="size-5 text-blue" />
        </div>
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 text-[clamp(26px,2.6vw,34px)] leading-tight font-medium tracking-[-0.035em]">
            Check your email
          </h1>
          <p className="m-0 text-pretty text-[clamp(15px,1.4vw,18px)] leading-normal text-grey">
            We sent a verification link to{" "}
            <span className="text-ink">{submittedEmail}</span>. Click it to
            finish creating your account.
          </p>
        </div>
        <AuthFooter
          prompt="Wrong address?"
          ctaLabel="Back to sign in"
          ctaHref={AUTH_ROUTES.signIn}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <AuthHeading mode="sign-up" method="email" />

      <div className="flex flex-col gap-[18px]">
        <AuthError error={error} />
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      autoComplete="name"
                      placeholder="John Doe"
                      disabled={isBusy}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="m@example.com"
                      disabled={isBusy}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      disabled={isBusy}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>At least 8 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AuthSubmit
              label="Create account"
              isSubmitting={isSubmitting}
              isBusy={isBusy}
            />
            <GoogleButton
              label="Continue with Google"
              onClick={() => google.run(callbackURL, setError)}
              isPending={google.isPending}
              isBusy={isBusy}
            />
          </form>
        </Form>

        <AuthAssurances mode="sign-up" />
      </div>

      <AuthFooter
        prompt="Already have an account?"
        ctaLabel="Sign in"
        ctaHref={AUTH_ROUTES.signIn}
      />
    </div>
  );
}

/* ---------- Google only ---------- */

/**
 * SOURCE OF TRUTH KEYWORDS: GoogleOnlyForm
 *
 * WHAT:  The whole auth surface when NEXT_PUBLIC_EMAIL_AUTH_ENABLED=false —
 *        an error slot and ONE button. Nothing else.
 * WHY:   This is the screen the design was drawn for: one saturated element on
 *        the whole page, so its states carry the entire interaction. With one
 *        method there is nothing to "continue with", so the divider is dropped
 *        and the button becomes the primary action. Both routes render the same
 *        thing on purpose: implicit sign-up is on in this mode (see auth.ts), so
 *        one button both creates the account and signs an existing user in —
 *        which is why the label is "Continue with", and why the sign-in ↔
 *        sign-up cross-link footer is omitted rather than pointing at an
 *        identical page.
 *
 *        The kicker, title, description and the ruled assurance list are GONE
 *        from this surface. They were a second pitch stacked on top of the one
 *        already running down the panel beside it — the reader met the argument
 *        twice and the button third. The facts themselves did not go anywhere:
 *        they are the trust panel in auth-shell.tsx, where they answer the
 *        question the button raises instead of delaying it. What is left here
 *        is the control, which is all this column ever needed to be.
 * WHERE: Returned by AuthForm when EMAIL_AUTH_ENABLED is false.
 */
function GoogleOnlyForm({ callbackURL }: { callbackURL: string }) {
  const { error, setError, google } = useAuthEffects();

  /* No `mode`: with the copy gone there is nothing left for it to switch, and
   * sign-in and sign-up now render byte-identical surfaces. */
  return (
    <div className="flex flex-col gap-[18px]">
      <AuthError error={error} />
      <GoogleButton
        label="Continue with Google"
        onClick={() => google.run(callbackURL, setError)}
        isPending={google.isPending}
        isBusy={google.isPending}
        withDivider={false}
      />
    </div>
  );
}

/* ---------- Shared bits ---------- */

/* Kicker, title, description. `method` picks between the two descriptions the
 * mode carries — see MARKETING_AUTH_COPY for why there are two. */
function AuthHeading({
  mode,
  method,
}: {
  mode: AuthFormMode;
  method: "google" | "email";
}) {
  const copy = MARKETING_AUTH_COPY[mode];
  return (
    <div className="flex flex-col gap-[11px]">
      <PaperLabel tone="blue" className="text-[11px] tracking-[0.14em]">
        {copy.kicker}
      </PaperLabel>
      <h1 className="m-0 text-[clamp(26px,2.6vw,34px)] leading-tight font-medium tracking-[-0.035em]">
        {copy.title}
      </h1>
      <p className="m-0 text-pretty text-[clamp(15px,1.4vw,18px)] leading-normal text-grey">
        {method === "google" ? copy.googleDescription : copy.emailDescription}
      </p>
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: AuthAssurances, MARKETING_AUTH_ASSURANCES
 *
 * WHAT:  The three numbered promises under the action, ruled off from it.
 * WHY:   These answer the objections that actually stop a signup — nothing
 *        posts without approval, no card, and you can leave — so they sit below
 *        the button where someone hesitating will read them, not above it where
 *        they would delay someone who has already decided. The list is ruled
 *        with `border-hair` INSIDE the ink top rule, which is the design's
 *        distinction between a boundary and a separator.
 */
function AuthAssurances({ mode }: { mode: AuthFormMode }) {
  return (
    <ul className="flex list-none flex-col border-t border-ink p-0">
      {MARKETING_AUTH_ASSURANCES[mode].map((text, index, all) => (
        <li
          key={text}
          className={
            index === all.length - 1
              ? "flex items-start gap-3 py-3"
              : "flex items-start gap-3 border-b border-hair py-3"
          }
        >
          <PaperLabel
            as="span"
            size="micro"
            tone="blue"
            className="flex-none pt-0.5 tracking-[0.1em]"
          >
            {`0${index + 1}`}
          </PaperLabel>
          <p className="m-0 text-[13.5px] leading-normal">{text}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: AuthError, red alert, --red, --red-surface,
 *   --red-ink, role=alert
 *
 * WHAT:  The error banner above the action.
 * WHY:   Restyled, not rewired — the state and the messages it renders are
 *        unchanged. Square, 1px red border on the red surface tint, with the
 *        darker red for the text: red is the ONLY colour on either page allowed
 *        outside the paper/ink/blue palette, and it appears only here, which is
 *        what makes it register instantly when it does.
 */
function AuthError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="border border-red bg-red-surface px-3.5 py-3 text-[13px] leading-normal text-red-ink"
    >
      {error}
    </div>
  );
}

function AuthSubmit({
  label,
  isSubmitting,
  isBusy,
}: {
  label: string;
  isSubmitting: boolean;
  isBusy: boolean;
}) {
  return (
    /* The commit action, so it takes the one blue on this screen — which is why
       the Google button below it steps down to `outline`. */
    <PaperButton type="submit" size="lg" block pending={isSubmitting} disabled={isBusy}>
      {isSubmitting ? (
        <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
      ) : null}
      {label}
    </PaperButton>
  );
}

function GoogleButton({
  label,
  onClick,
  isPending,
  isBusy,
  /* The divider only earns its place when there is another method above it to
     be an alternative TO — Google-only mode passes false. */
  withDivider = true,
}: {
  label: string;
  onClick: () => void;
  isPending: boolean;
  isBusy: boolean;
  withDivider?: boolean;
}) {
  if (!GOOGLE_AUTH_ENABLED) return null;
  return (
    <>
      {withDivider ? (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-px flex-1 bg-hair" />
          <PaperLabel as="span" size="micro" tone="grey">
            or
          </PaperLabel>
          <span aria-hidden="true" className="h-px flex-1 bg-hair" />
        </div>
      ) : null}
      <PaperButton
        /* Google-only mode makes this the commit action of the page, so it takes
           the one blue; beside an email submit it must not compete with it. */
        variant={withDivider ? "outline" : "blue"}
        size="lg"
        block
        onClick={onClick}
        pending={isPending}
        disabled={isBusy && !isPending}
      >
        {isPending ? (
          <span
            aria-hidden="true"
            className="size-[15px] flex-none animate-spin rounded-full border-2 border-current/40 border-t-current"
          />
        ) : (
          <GoogleGlyph />
        )}
        {isPending ? "Opening Google…" : label}
      </PaperButton>
    </>
  );
}

function AuthFooter({
  prompt,
  ctaLabel,
  ctaHref,
}: {
  prompt: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <p className="m-0 text-sm text-grey">
      {prompt}{" "}
      <Link href={ctaHref} className="text-ink underline underline-offset-4">
        {ctaLabel}
      </Link>
    </p>
  );
}

/* Shared error state + Google handler. */
function useAuthEffects() {
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  async function run(callbackURL: string, setErr: (v: string | null) => void) {
    if (isPending) return;
    setErr(null);
    setIsPending(true);
    try {
      const { error: authError } = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
      if (authError)
        setErr(authError.message ?? "Google sign-in failed. Try again.");
    } finally {
      setIsPending(false);
    }
  }

  return { error, setError, google: { isPending, run } };
}

/* Inline Google "G" mark. */
function GoogleGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
    >
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill="currentColor"
      />
    </svg>
  );
}
