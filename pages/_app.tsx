import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { ChatProvider } from "@/components/ChatContext";
import ChatWidget from "@/components/ChatWidget";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const heading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>ArtiSync — Discover talent. Create together.</title>
        <meta name="description" content="ArtiSync connects clients with talented artists for events, performances, and creative collaborations." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#141A33" />
      </Head>
      <main className={`${body.variable} ${heading.variable}`}>
        <ToastProvider>
          <ChatProvider>
            <Component {...pageProps} />
            <ChatWidget />
          </ChatProvider>
        </ToastProvider>
      </main>
    </>
  );
}
