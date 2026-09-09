import axios from "axios";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

interface UserResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  profilePhoto: string | null;
  roles: string;
}

interface LoginResponse {
  statusCode: number;
  data: {
    accessToken: string;
    user: UserResponse;
  };
  message: string;
  success: boolean;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }
        try {
          // Verify password
          if (!credentials.password) {
            return null;
          }
          const response = await axios.post<any>(
            `${process.env.BACKEND_URL}/auth/login`,
            {
              email: credentials.email,
              password: credentials.password,
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 10000,
            }
          );

          if (response.data.success && response.data.data) {
            const { user, accessToken } = response.data.data;

            if (user && user.id) {
              const userObject = {
                id: user.id.toString(),
                email: user.email,
                name: `${user.firstName} ${user.lastName}`.trim(),
                firstName: user.firstName,
                lastName: user.lastName,
                mobile: user.mobile,
                profilePhoto: user.profilePhoto,
                role: user.roles,
                accessToken: accessToken,
              };

              return userObject;
            }
          }

          return null;
        } catch (error) {
          console.error("Authentication error:", error);

          if (axios.isAxiosError(error)) {
            console.error("Axios error details:", {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
              message: error.message
            });

            if (error.response?.data?.message) {
              throw new Error(error.response.data.message);
            }

            if (error.code === 'ECONNREFUSED') {
              throw new Error("Unable to connect to authentication server");
            }

            if (error.code === 'ETIMEDOUT') {
              throw new Error("Authentication request timed out");
            }
          }

          throw new Error("Authentication failed. Please try again.");
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token-admin",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false, // Set to false for HTTP compatibility on port 81
      },
    },
    callbackUrl: {
      name: "next-auth.callback-url-admin",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    csrfToken: {
      name: "next-auth.csrf-token-admin",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier-admin",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 900,
      },
    },
    state: {
      name: "next-auth.state-admin",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 900,
      },
    },
    nonce: {
      name: "next-auth.nonce-admin",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
        token.mobile = (user as any).mobile;
        token.profilePhoto = (user as any).profilePhoto;
        token.role = (user as any).role;
        token.accessToken = (user as any).accessToken;
      }

      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.firstName) token.firstName = session.firstName;
        if (session.lastName) token.lastName = session.lastName;
        if (session.mobile) token.mobile = session.mobile;
        if (session.profilePhoto !== undefined) token.profilePhoto = session.profilePhoto;
        if (session.role) token.role = session.role;
        if (session.email) token.email = session.email;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        (session.user as any).firstName = token.firstName as string;
        (session.user as any).lastName = token.lastName as string;
        (session.user as any).mobile = token.mobile as string;
        (session.user as any).profilePhoto = token.profilePhoto as string | null;
        (session.user as any).role = token.role as string;
        (session.user as any).accessToken = token.accessToken as string;
      }

      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};