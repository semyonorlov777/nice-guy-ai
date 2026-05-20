import { NextResponse, type NextRequest } from "next/server";
import { isAnketaProgram } from "@/lib/anketa/questions";

export const dynamic = "force-dynamic";

// Помечает программу как «предложили анкету» и редиректит на саму анкету.
// Cookie ставится здесь (в Route Handler), потому что Server Components
// в Next.js 16 не имеют права записывать cookies.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get("slug") ?? "";

  if (!isAnketaProgram(slug)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const target = new URL(`/program/${slug}/anketa`, request.url);
  const response = NextResponse.redirect(target);
  response.cookies.set(`anketa_offered_${slug}`, "1", {
    maxAge: 60 * 60 * 24 * 90,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
