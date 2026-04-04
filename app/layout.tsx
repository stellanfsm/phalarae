import type { Metadata } from "next";
import { IBM_Plex_Sans, Lora } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const lora = Lora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const plex = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Phalerae — Intake assistant",
  description: "Structured AI intake for personal injury law firms. Not legal advice.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isEmbed = (await headers()).get("x-phalerae-embed") === "1";

  return (
    <html
      lang="en"
      className={`${lora.variable} ${plex.variable} h-full antialiased${isEmbed ? " phalerae-embed" : ""}`}
    >
      <body className={isEmbed ? "phalerae-embed m-0 flex min-h-0 flex-col bg-transparent p-0" : "min-h-full flex flex-col"}>
        {children}
      </body>
    </html>
  );
}
