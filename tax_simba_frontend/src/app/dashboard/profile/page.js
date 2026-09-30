import { redirect } from "next/navigation";

/** Legacy /dashboard/profile → canonical edit-profile route. */
export default function ProfileRedirectPage() {
  redirect("/dashboard/edit-profile");
}
