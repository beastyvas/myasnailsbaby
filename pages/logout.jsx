// pages/logout.jsx
import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/utils/supabaseClient";

export default function Logout() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.signOut().finally(() => router.replace("/login"));
  }, [router]);
  return null;
}
