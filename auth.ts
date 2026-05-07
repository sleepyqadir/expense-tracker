import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

/** JWT/session encryption; required when NODE_ENV=production */
const authSecret =
  process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive.file",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  secret: authSecret,
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string
        session.accessToken = token.accessToken as string
      }
      return session
    },
  },
}
