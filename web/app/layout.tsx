import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeRun — is this code safe to run?",
  description:
    "Paste untrusted or AI-generated code and see what it actually does in a disposable sandbox, before it touches your machine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
