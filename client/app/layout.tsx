import type { Metadata } from "next";
import { Eagle_Lake } from "next/font/google";
import "./globals.css";


const eagleLake = Eagle_Lake({ 
  subsets: ["latin"],
  variable: '--font-eagle-lake',
  weight: ['400']
});

export const metadata: Metadata = {
  title: "Pavalon",
  description: "A multiplayer social deduction game of loyalty and deception, set in the age of Arthurian legends. Uncover the spies or sabotage the kingdom from within.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${eagleLake.variable} font-eaglelake text-slate-300 min-h-[100dvh] overflow-hidden bg-cover bg-center relative `} style={{ backgroundImage: `url(background/5-players.jpg)` }} >
        {children}
      </body>
    </html>
  );
}
