import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Auto Poster",
  description: "AI-assisted Facebook page posting dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground font-sans text-sm antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
