import { type NextAuthOptions } from "next-auth";
import { type JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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
          throw new Error("Email y contraseña son obligatorios");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Credenciales inválidas");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          throw new Error("Credenciales inválidas");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
    // Magic-link flow stub — to be wired up with email token verification
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
          throw new Error("Token inválido o expirado");
        }

        // Consume the token
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

        // Fetch the first membership for initial orgId/role
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
        });

        token.orgId = membership?.orgId ?? null;
        token.role = membership?.role ?? null;
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
