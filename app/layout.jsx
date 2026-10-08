import { Cinzel, DM_Sans } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata = {
  title: "Khilafat Esports",
  description: "Compete to become the best at Khilafat Esports.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${cinzel.variable} ${dmSans.variable}`}>{children}</body>
    </html>
  );
}
