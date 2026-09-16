import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const display = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

const body = Nunito({
  subsets: ["latin", "vietnamese"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "duplex",
  description: "Realtime chat with group conversations and WebRTC calling",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
    >
      <body className="min-h-dvh font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
