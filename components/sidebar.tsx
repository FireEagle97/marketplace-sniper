/**
 * Sidebar component for the Template App
 * Provides primary navigation for the dashboard with a clean, modern UI
 * Features user avatar at the bottom and billing management option
 */
"use client";

import { Home, Settings, Database, Target, Users, Sparkles, CreditCard } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SelectProfile } from "@/db/schema/profiles-schema";
import { CreditUsageDisplay } from "@/components/credit-usage-display";
import UpgradePlanPopup from "@/components/upgrade-plan-popup";
import { useState, useEffect, useCallback } from "react";

interface SidebarProps {
  profile: SelectProfile | null;
  userEmail?: string;
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string;
}

export default function Sidebar({ profile, userEmail, whopMonthlyPlanId, whopYearlyPlanId }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  
  const isActive = (path: string) => pathname === path;
  
  // Check if user has reached credit limit
  const hasReachedCreditLimit = useCallback(() => {
    if (!profile) return false;
    const usedCredits = profile.usedCredits ?? 0;
    const usageCredits = profile.usageCredits ?? 0;
    return usedCredits >= usageCredits;
  }, [profile]);

  // Plan IDs now come from props, not environment variables
  
  const navItems = [
    { href: "/dashboard", icon: <Home size={16} />, label: "Home" },
    { href: "/dashboard/settings", icon: <Settings size={16} />, label: "Settings" },
    { href: "/dashboard/data-source", icon: <Database size={16} />, label: "Data source" },
    { href: "/dashboard/targets", icon: <Target size={16} />, label: "Targets" },
    { href: "/dashboard/members", icon: <Users size={16} />, label: "Members" },
  ];

  // Handle navigation item click
  const handleNavItemClick = (e: React.MouseEvent, href: string) => {
    if (hasReachedCreditLimit()) {
      e.preventDefault(); // Prevent navigation
      setShowUpgradePopup(true); // Show upgrade popup
    } else {
      // Normal navigation handled by Link component
    }
  };
  
  // Show upgrade popup on initial load if needed
  useEffect(() => {
    if (hasReachedCreditLimit()) {
      setShowUpgradePopup(true);
    }
  }, [profile, hasReachedCreditLimit]);

  return (
    <>
      {profile && (
        <UpgradePlanPopup 
          profile={profile} 
          monthlyPlanId={whopMonthlyPlanId} 
          yearlyPlanId={whopYearlyPlanId}
          isOpen={showUpgradePopup}
          onOpenChange={setShowUpgradePopup}
        />
      )}
      
      <div className="h-screen w-[60px] md:w-[220px] bg-white/60 backdrop-blur-xl border-r border-white/40 flex flex-col justify-between py-5 relative overflow-hidden">
        {/* Glassmorphism effects */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none"
          animate={{ 
            opacity: [0.4, 0.6, 0.4],
            background: [
              "linear-gradient(to bottom, rgba(var(--primary), 0.03), transparent, rgba(var(--primary), 0.03))",
              "linear-gradient(to bottom, rgba(var(--primary), 0.05), transparent, rgba(var(--primary), 0.05))",
              "linear-gradient(to bottom, rgba(var(--primary), 0.03), transparent, rgba(var(--primary), 0.03))"
            ]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Enhanced edge highlights for 3D effect */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gray-300/50 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white to-transparent opacity-80" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white to-transparent opacity-80" />

        {/* Logo */}
        <div className="px-3 mb-8 relative z-10">
          <Link href="/dashboard">
            <motion.div 
              className="flex items-center justify-center md:justify-start"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <div className="hidden md:block">
                <span className="font-bold text-lg">App Name</span>
              </div>
              <div className="block md:hidden text-center">
                <span className="font-bold text-sm">A</span>
              </div>
            </motion.div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 relative z-10">
          <div className="space-y-1.5">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className="block"
                onClick={(e) => handleNavItemClick(e, item.href)}
              >
                <motion.div 
                  className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all ${
                    isActive(item.href) 
                      ? "bg-[#1a1a1a] text-white shadow-sm" 
                      : "text-gray-600 hover:bg-gray-100/80 hover:border-gray-200/50 hover:shadow-md"
                  }`}
                  whileHover={{ 
                    scale: 1.03, 
                    x: 4,
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className={`ml-3 hidden md:block text-sm font-medium`}>
                    {item.label}
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>
        </nav>

        {/* Bottom Section - Account and Subscription Management */}
        <div className="mt-auto pt-4 relative z-10">
          {/* Subscription Management Section */}
          <div className="px-3 mb-4">
            {/* Subtle section divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4" />
            
            {/* Upgrade Button - Links to pricing page */}
            <Link href="/pricing">
              <motion.div
                whileHover={{ 
                  scale: 1.03,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.97 }}
              >
                <Button 
                  variant="default" 
                  size="sm"
                  className="w-full flex items-center justify-center md:justify-start gap-1.5 py-1.5 h-auto transition-colors shadow-sm mb-3 relative overflow-hidden group"
                >
                  {/* Button hover effect */}
                  <span className="absolute inset-0 w-full h-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Sparkles size={14} className="relative z-10" />
                  <span className="hidden md:block text-xs font-medium relative z-10">Upgrade</span>
                </Button>
              </motion.div>
            </Link>
            
            {/* Billing Button - Only visible for members with whopMembershipId */}
            {profile?.whopMembershipId && (
              <Link 
                href={`http://whop.com/orders/${profile.whopMembershipId}/manage`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <motion.div
                  whileHover={{ 
                    scale: 1.03,
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full flex items-center justify-center md:justify-start gap-1.5 border-white/60 bg-white/70 hover:bg-white/90 hover:border-white py-1.5 h-auto transition-all shadow-sm hover:shadow-md"
                  >
                    <CreditCard size={14} className="text-gray-600" />
                    <span className="hidden md:block text-xs">Billing</span>
                  </Button>
                </motion.div>
              </Link>
            )}
          </div>
          
          {/* Credit Usage Display */}
          <div className="px-3 mb-4">
            <div className="hidden md:block">
              <CreditUsageDisplay />
            </div>
            <div className="block md:hidden text-center">
              <div className="bg-white/80 py-2 px-1 rounded-lg shadow-sm border border-white/80">
                <div className="text-[10px] font-medium text-gray-600 mb-1">Credits</div>
                <div className="flex justify-center">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <svg 
                      viewBox="0 0 24 24" 
                      className="w-3.5 h-3.5 text-primary"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* User Profile Section */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <motion.div 
            className="flex items-center px-3 py-3 hover:bg-white/50 rounded-lg mx-2 cursor-pointer"
            whileHover={{ 
              scale: 1.02,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden border border-white/80 flex items-center justify-center bg-white/80 shadow-sm">
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    userButtonAvatarBox: "w-7 h-7",
                    userButtonTrigger: "w-7 h-7 rounded-full"
                  }
                }} 
              />
            </div>
            <span className="text-xs text-gray-600 hidden md:block ml-3 font-medium truncate max-w-[120px]">
              {userEmail || "Account"}
            </span>
          </motion.div>
        </div>
      </div>
    </>
  );
} 