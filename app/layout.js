import "./globals.css";
import { Cairo } from "next/font/google";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Arabic Sarcasm Analyzer",
  description: "Test Arabic sarcasm detection with Hugging Face Inference API.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.className}>
      <body>{children}</body>
    </html>
  );
}
