import type { Metadata } from "next";
import { Cinzel, Eagle_Lake } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({ 
  subsets: ["latin"],
  variable: '--font-cinzel',
  weight: ['400', '700']
});
const eagleLake = Eagle_Lake({ 
  subsets: ["latin"],
  variable: '--font-eagle-lake',
  weight: ['400']
});

export const metadata: Metadata = {
  title: "Avalon Online",
  description: "A multiplayer social deduction game of loyalty and deception, set in the age of Arthurian legends. Uncover the spies or sabotage the kingdom from within.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${cinzel.variable} ${eagleLake.variable} font-eaglelake`}>
        <div className="fixed top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 -z-10"></div>
        {children}
      </body>
    </html>
  );
}
