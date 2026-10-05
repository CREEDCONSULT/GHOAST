import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GHOAST — Your Instagram has ghosts",
    template: "%s · GHOAST",
  },
  description:
    "See exactly who doesn’t follow you back — from your own Instagram export, read on your device. Never your password.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0D0A14",
  width: "device-width",
  initialScale: 1,
};

// Applies persisted theme before first paint (flash-free), safe with CSP
// 'unsafe-inline' which our next.config.ts already allows for styles/scripts on self.
const themeInit = `try{var s=JSON.parse(localStorage.getItem("ghoast-ui")||"{}");document.documentElement.dataset.theme=s.theme||"dark";if(s.reducedMotion)document.documentElement.dataset.reducedMotion="true";}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
