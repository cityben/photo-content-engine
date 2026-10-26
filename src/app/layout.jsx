import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Photo Content Engine — Acme Ltd",
  description: "Turn job site photos into ready-to-post marketing content.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="font-sans">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
