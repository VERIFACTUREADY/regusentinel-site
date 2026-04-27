import { type NextAuthOptions } from "next-auth";
import { type JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      orgId: string | null;
      role: Role | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    orgId: string | null;
    role: Role | null;
  }
}

// On Vercel preview deployments NEXTAUTH_URL may not be set; fall back to VERCEL_URL.
if (process.env.VERCEL_URL && !process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

export const authOptions: NextAuthOptions = {
  // No PrismaAdapter: we use JWT sessions + CredentialsProvider.
  // PrismaAdapter requires Account/Session/VerificationToken tables that are
  // not in this schema and would cause 500 errors at runtime.
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contrasena son obligatorios");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Credenciales invalidas");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          throw new Error("Credenciales invalidas");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
    CredentialsProvider({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) {
          throw new Error("Token requerido");
        }

        const user = await prisma.user.findFirst({
          where: {
            magicToken: credentials.token,
            magicTokenExp: { gt: new Date() },
          },
        });

        if (!user) {
          throw new Error("Token invalido o expirado");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { magicToken: null, magicTokenExp: null },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }): Promise<JWT> {
      if (user) {
        token.userId = user.id;

        try {
          const membership = await prisma.membership.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: "asc" },
          });

          token.orgId = membership?.orgId ?? null;
          token.role = membership?.role ?? null;
        } catch {
          token.orgId = null;
          token.role = null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.userId,
        email: token.email as string,
        name: token.name as string | null,
        orgId: token.orgId,
        role: token.role,
      };

      return session;
    },
  },
};
