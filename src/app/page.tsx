import { redirect } from "next/navigation";

// Root → send to home (auth check happens inside the (app) layout)
export default function RootPage() {
  redirect("/home");
}
