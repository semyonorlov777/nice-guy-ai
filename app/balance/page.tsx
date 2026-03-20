import { redirect } from "next/navigation";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";

export default function BalanceRedirect() {
  redirect(`/program/${DEFAULT_PROGRAM_SLUG}/balance`);
}
