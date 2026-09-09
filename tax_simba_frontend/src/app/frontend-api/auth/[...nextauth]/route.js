import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import axios from "axios";

/**
 * P0 K.3 — Credentials/password only.
 * Google provider removed (D2 / A10). OTP login-with-code path removed (D1 / A11).
 * Ownership flags come from compat login (my-services ACTIVE), not isSubscriptionBuy.
 */
export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { name: "email", type: "text" },
        password: { name: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const res = await axios.post(`${process.env.API_URL}/auth/login`, {
            email: credentials.email,
            password: credentials.password,
          });

          const user = res.data;

          if (res.status === 200 && user.data.accessToken) {
            return {
              ...user.data.user,
              accessToken: user.data.accessToken,
              hasActiveSa: user.data.hasActiveSa ?? user.data.user?.hasActiveSa ?? false,
              hasActiveMtd: user.data.hasActiveMtd ?? user.data.user?.hasActiveMtd ?? false,
              hasActiveService:
                user.data.hasActiveService ?? user.data.user?.hasActiveService ?? false,
              ownership: user.data.ownership ?? user.data.user?.ownership ?? "neither",
              isEngagementLetterAccepted:
                user.data.isEngagementLetterAccepted ??
                user.data.user?.isEngagementLetterAccepted ??
                false,
              // Deprecated — never SoT
              isSubscriptionBuy: false,
            };
          }

          return null;
        } catch (error) {
          console.error("Authorize error:", error);
          if (axios.isAxiosError(error)) {
            const message = error.response?.data?.message || "Login failed. Please try again.";
            throw new Error(message);
          }
          throw new Error("Something went wrong during login.");
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        if (session.hasActiveSa !== undefined) token.hasActiveSa = session.hasActiveSa;
        if (session.hasActiveMtd !== undefined) token.hasActiveMtd = session.hasActiveMtd;
        if (session.hasActiveService !== undefined) {
          token.hasActiveService = session.hasActiveService;
        }
        if (session.ownership !== undefined) token.ownership = session.ownership;
        if (session.isEngagementLetterAccepted !== undefined) {
          token.isEngagementLetterAccepted = session.isEngagementLetterAccepted;
        }
        if (token.user) {
          token.user = {
            ...token.user,
            hasActiveSa: token.hasActiveSa,
            hasActiveMtd: token.hasActiveMtd,
            hasActiveService: token.hasActiveService,
            ownership: token.ownership,
            isSubscriptionBuy: false,
            isEngagementLetterAccepted:
              session.isEngagementLetterAccepted !== undefined
                ? session.isEngagementLetterAccepted
                : token.user.isEngagementLetterAccepted,
            isTaxInfoSubmitted:
              session.isTaxInfoSubmitted !== undefined
                ? session.isTaxInfoSubmitted
                : token.user.isTaxInfoSubmitted,
          };
        }
        // Explicitly ignore any attempt to set isSubscriptionBuy as entitlement SoT.
      }

      if (user && user.accessToken) {
        token.accessToken = user.accessToken;
        token.user = user;
        token.hasActiveSa = user.hasActiveSa ?? false;
        token.hasActiveMtd = user.hasActiveMtd ?? false;
        token.hasActiveService = user.hasActiveService ?? false;
        token.ownership = user.ownership ?? "neither";
        token.isEngagementLetterAccepted = user.isEngagementLetterAccepted ?? false;
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user = {
        ...(token.user || {}),
        hasActiveSa: token.hasActiveSa ?? false,
        hasActiveMtd: token.hasActiveMtd ?? false,
        hasActiveService: token.hasActiveService ?? false,
        ownership: token.ownership ?? "neither",
        isEngagementLetterAccepted:
          token.isEngagementLetterAccepted ??
          token.user?.isEngagementLetterAccepted ??
          false,
        isSubscriptionBuy: false,
      };
      session.hasActiveSa = token.hasActiveSa ?? false;
      session.hasActiveMtd = token.hasActiveMtd ?? false;
      session.hasActiveService = token.hasActiveService ?? false;
      session.ownership = token.ownership ?? "neither";
      session.isEngagementLetterAccepted = session.user.isEngagementLetterAccepted;
      return session;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  cookies: {
    sessionToken: {
      name: "next-auth.session-token-frontend",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    callbackUrl: {
      name: "next-auth.callback-url-frontend",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    csrfToken: {
      name: "next-auth.csrf-token-frontend",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
