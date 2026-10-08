import { Cinzel, DM_Sans } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Khilafat Control",
  description: "Private tournament administration for Khilafat Esports.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${cinzel.variable} ${dmSans.variable}`}>
        {children}
      </body>
    </html>
  );
}
