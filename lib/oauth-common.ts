import { createServiceClient } from "@/lib/supabase-server";
import crypto from "crypto";

interface FindOrCreateOAuthUserParams {
  provider: string;
  emailPrefix: string;
  hmacInput: string;
  secret: string;
  lookupField: string;
  lookupValue: string | number;
  existingProfileUpdate: Record<string, unknown>;
  newProfileData: Record<string, unknown>;
}

function generatePassword(input: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(input)
    .digest("base64url");
}

export async function findOrCreateOAuthUser(params: FindOrCreateOAuthUserParams) {
  const supabase = createServiceClient();

  const fakeEmail = `${params.emailPrefix}_${params.lookupValue}@niceguy.local`;
  const password = generatePassword(params.hmacInput, params.secret);

  // Check if profile with this provider ID exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq(params.lookupField, params.lookupValue)
    .maybeSingle();

  if (existingProfile) {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email: fakeEmail, password });

    if (signInError) throw new Error(`${params.provider} login failed: ${signInError.message}`);

    await supabase
      .from("profiles")
      .update(params.existingProfileUpdate)
      .eq("id", existingProfile.id);

    return signInData.session;
  }

  // New user: create
  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
    });

  if (createError) throw new Error(`User creation failed: ${createError.message}`);

  await supabase
    .from("profiles")
    .update(params.newProfileData)
    .eq("id", createData.user.id);

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email: fakeEmail, password });

  if (signInError) throw new Error(`Login after creation failed: ${signInError.message}`);

  return signInData.session;
}
