import "./globals.css";
import type { Metadata } from "next";
import { initializeServerLogging } from "@/lib/server-logger";

// Initialize server-side logging for server components
initializeServerLogging();

export const metadata: Metadata = {
  title: "Web-LLM Test App",
  description: "Testing web-llm with Hugging Face models in browser",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">
        <div className="container mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <header className="mb-6">
            <h1 className="text-3xl font-bold">Web-LLM Test App</h1>
            <p className="text-muted-foreground">
              Test Hugging Face models in your browser using web-llm
            </p>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
