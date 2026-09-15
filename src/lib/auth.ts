import { type NextAuthOptions } from "next-auth";
import { type JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

/**
 * Google SSO opcional. Sólo se activa si GOOGLE_CLIENT_ID y
 * GOOGLE_CLIENT_SECRET están en el entorno. Permite a clientes con
 * Google Workspace iniciar sesión sin contraseña — alineado con la
 * promesa de "SSO" del plan Firma en /precios.
 */
export const ssoEnabled =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

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

const baseProviders: NextAuthOptions["providers"] = [];

if (ssoEnabled) {
  baseProviders.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Restricción opcional por dominio del Workspace del cliente
      // (e.g. "tugestoria.es"). Si no se configura, acepta cualquier cuenta.
      authorization: process.env.GOOGLE_WORKSPACE_HD
        ? { params: { hd: process.env.GOOGLE_WORKSPACE_HD } }
        : undefined,
    }),
  );
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
    ...baseProviders,
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
    /**
     * Sign-in callback. Para Google: persistimos al usuario en nuestra DB
     * (upsert por email) y reescribimos `user.id` a nuestro CUID para que
     * los callbacks posteriores (jwt) tengan el id correcto. Si el email
     * no llega del proveedor, bloqueamos el inicio.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = (profile?.email || user?.email || "").toLowerCase().trim();
        if (!email) return false;

        const dbUser = await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name: profile?.name || user?.name || email,
          },
          update: {
            // Sólo actualiza name si Google nos da uno y el actual está vacío.
            ...(((profile?.name || user?.name) && !user?.name) && {
              name: profile?.name || user?.name || undefined,
            }),
          },
        });
        // Reescribimos el id para el resto del flujo (jwt callback usa user.id).
        user.id = dbUser.id;
        user.email = dbUser.email;
        user.name = dbUser.name;
      }
      return true;
    },

    async jwt({ token, user }): Promise<JWT> {
      if (user) {
        token.userId = user.id;
      }

      // Auto-reparación: si tenemos usuario pero todavía no hay organización
      // en el token, intentamos (re)cargar la membresía en cada petición.
      // Esto recupera sesiones creadas antes de que existiera la organización
      // o cuando la consulta de membresía falló de forma transitoria al
      // iniciar sesión. En cuanto la membresía existe, el token se sana solo
      // y deja de consultarse.
      if (token.userId && !token.orgId) {
        try {
          const membership = await prisma.membership.findFirst({
            where: { userId: token.userId },
            orderBy: { createdAt: "asc" },
          });
          if (membership) {
            token.orgId = membership.orgId;
            token.role = membership.role;
          } else {
            token.orgId = token.orgId ?? null;
            token.role = token.role ?? null;
          }
        } catch {
          // Mantener los valores actuales del token ante un fallo transitorio.
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
