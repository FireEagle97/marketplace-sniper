"use client";

/**
 * Layout Wrapper component for Template App
 * Controls when to show the header based on the current URL path
 * Prevents header from appearing on dashboard pages
 */
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/header";

interface LayoutWrapperProps {
  children: ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  
  // Don't show header on dashboard routes
  const isDashboardRoute = pathname.startsWith("/dashboard");
  
  return (
    <>
      {!isDashboardRoute && <Header />}
      <main>
        {children}
      </main>
    </>
  );
} 