import { Eagle_Lake } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/context/ClientProviders";
import DynamicBackground from "@/components/ui/DynamicBackground";


const eagleLake = Eagle_Lake({ 
  subsets: ["latin"],
  variable: '--font-eagle-lake',
  weight: ['400'],
  display: 'swap',
});

export const metadata = {
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
      <body className={`${eagleLake.variable} font-eaglelake`}>
        <ClientProviders>
          <DynamicBackground>
            {children}
          </DynamicBackground>
        </ClientProviders>
      </body>
    </html>
  );
}