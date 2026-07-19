import "@/styles/globals.css";
import { Toaster } from "react-hot-toast";

export default function App({ Component, pageProps }) {
  return (
    <div className="bg-cream-50 text-cream-900 font-outfit min-h-screen">
      <Toaster position="bottom-center" reverseOrder={false} />
      <Component {...pageProps} />
    </div>
  );
}
