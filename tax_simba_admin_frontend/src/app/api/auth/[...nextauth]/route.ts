// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

// Define the User type to match your backend response



const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };