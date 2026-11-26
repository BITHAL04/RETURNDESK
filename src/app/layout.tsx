import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ReturnDesk", template: "%s · ReturnDesk" },
  description: "Returns desk for support agents",
};

export const viewport: Viewport = { themeColor: "#111215" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border-line !shadow-raised !font-sans",
              description: "!text-ink-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
