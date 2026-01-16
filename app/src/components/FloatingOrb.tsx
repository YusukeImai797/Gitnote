"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface NavItem {
  icon: string;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: "edit_square", label: "Write", href: "/editor" },
  { icon: "inventory_2", label: "Library", href: "/library" },
  { icon: "settings", label: "Settings", href: "/settings" },
];

export default function FloatingOrb() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  // Hide orb while typing (detect focus on contenteditable)
  // NOTE: This hook MUST be called before any conditional returns
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsVisible(false);
      }
    };
    const handleBlur = () => {
      setIsVisible(true);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);
    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  // Hide when not authenticated or on login page
  if (!session || pathname === "/") {
    return null;
  }

  const handleNavigate = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Backdrop when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Orb Container */}
      <div
        className={`fixed bottom-8 right-6 z-50 transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
          }`}
      >
        {/* Expanded Menu - Vertical list above orb */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 mb-2 bg-card border border-border rounded-2xl shadow-xl p-2 min-w-[140px] animate-slide-up">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href === "/settings" && pathname.startsWith("/connect"));

              return (
                <button
                  key={item.href}
                  onClick={() => handleNavigate(item.href)}
                  className={`
                    flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                    transition-colors
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                    }
                  `}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Orb Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            relative w-14 h-14 rounded-full
            flex items-center justify-center
            transition-all duration-300 ease-out
            shadow-xl hover:shadow-2xl
            ${isOpen
              ? 'bg-muted text-foreground rotate-45'
              : 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground animate-float'
            }
          `}
          style={{
            boxShadow: isOpen
              ? 'var(--shadow-lg)'
              : '0 8px 32px rgba(44, 62, 80, 0.3)',
          }}
        >
          <span className="material-symbols-outlined text-[26px] transition-transform duration-300">
            {isOpen ? 'close' : 'add'}
          </span>

          {/* Subtle pulse ring when closed */}
          {!isOpen && (
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          )}
        </button>

        {/* Current page indicator dot */}
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent-gold border-2 border-card shadow-sm" />
      </div>
    </>
  );
}

