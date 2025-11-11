import "@/styles/globals.css";
import { AppProps } from "next/app";
import { Navigation } from "@/components/nav/navigation";
import { Toaster } from "@/components/ui/sonner";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Navigation />
      <Component {...pageProps} />
      <Toaster />
    </>
  );
}
