import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";
import { apiError } from "@/lib/api-helpers";
import crypto from "crypto";

const DEV_EMAIL = "dev_test@niceguy.local";
const HMAC_INPUT = "dev-test-user";

function generatePassword(input: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(input).digest("base64url");
}

export async function GET(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const serviceClient = createServiceClient();
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const password = generatePassword(HMAC_INPUT, secret);

    // Check if dev user exists
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", DEV_EMAIL)
      .maybeSingle();

    if (!existingProfile) {
      // Create user via admin API
      const { data: createData, error: createError } =
        await serviceClient.auth.admin.createUser({
          email: DEV_EMAIL,
          password,
          email_confirm: true,
        });

      if (createError) {
        return apiError(`Ошибка создания пользователя: ${createError.message}`, 500);
      }

      // Set up profile with generous balance
      await serviceClient
        .from("profiles")
        .update({ name: "Dev Tester", balance_tokens: 99999 })
        .eq("id", createData.user.id);
    }

    // Sign in
    const { data: signInData, error: signInError } =
      await serviceClient.auth.signInWithPassword({
        email: DEV_EMAIL,
        password,
      });

    if (signInError) {
      return apiError(`Ошибка входа: ${signInError.message}`, 500);
    }

    const session = signInData.session;

    // Set session cookies (pattern from telegram/verify)
    const cookiesToSet: {
      name: string;
      value: string;
      options: Record<string, unknown>;
    }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookies) {
            cookiesToSet.push(...cookies);
          },
        },
      },
    );

    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    // Redirect to chat with cookies
    const redirectUrl = new URL(`/program/${DEFAULT_PROGRAM_SLUG}/chat`, request.url);
    const response = NextResponse.redirect(redirectUrl);

    cookiesToSet.forEach(({ name, value, options }) =>
      response.cookies.set(
        name,
        value,
        options as Parameters<typeof response.cookies.set>[2],
      ),
    );

    return response;
  } catch (err) {
    console.error("Dev login error:", err);
    return apiError(err instanceof Error ? err.message : "Ошибка dev-логина", 500);
  }
}
