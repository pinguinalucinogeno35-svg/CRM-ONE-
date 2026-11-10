import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function Home() {
  const ctx = await requireUser();
  redirect(ctx.isAdmin ? "/admin" : "/painel");
}
