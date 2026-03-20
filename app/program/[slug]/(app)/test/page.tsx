import { redirect } from "next/navigation";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";

export default function OldTestPage() {
  redirect(`/program/${DEFAULT_PROGRAM_SLUG}/test/issp`);
}
