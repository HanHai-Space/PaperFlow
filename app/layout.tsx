import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";
import { fontSans } from "@/config/fonts";

export const metadata: Metadata = {
  title: {
    default: "Paper Burner - PDF OCR与翻译工具",
    template: "%s - Paper Burner",
  },
  description: "使用 Mistral OCR 提取 PDF 文本并转换为 Markdown，支持多种 AI 模型进行翻译",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="zh-CN">
      <head />
      <body
        className={clsx(
          "min-h-screen text-foreground bg-background font-sans antialiased disable-context-menu",
          fontSans.variable,
          fontSans.className
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          <div className="app-container relative flex flex-col min-h-screen">
            <main className="app-content flex-grow">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
