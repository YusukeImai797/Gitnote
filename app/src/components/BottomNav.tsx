"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface NavItemProps {
    icon: string;
    label: string;
    href: string;
    active?: boolean;
    onClick?: () => void;
}

function NavItem({ icon, label, href, active, onClick }: NavItemProps) {
    const router = useRouter();

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else {
            router.push(href);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`flex flex-col items-center justify-center gap-1 w-16 py-2 transition-colors ${active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
        >
            <span
                className="material-symbols-outlined text-[26px]"
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
            >
                {icon}
            </span>
            <span className="text-[10px] font-bold">{label}</span>
            {active && (
                <div className="absolute -top-1 w-10 h-1 rounded-b-lg bg-primary opacity-30" />
            )}
        </button>
    );
}

export default function BottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();

    // Don't show nav if not authenticated or on login page
    if (!session || pathname === "/") {
        return null;
    }

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 dark:bg-card/95 backdrop-blur-xl border-t border-border pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            <div className="flex justify-around items-center max-w-md mx-auto h-16 relative">
                <NavItem
                    icon="edit_square"
                    label="Write"
                    href="/editor"
                    active={pathname === "/editor"}
                />
                <NavItem
                    icon="inventory_2"
                    label="Library"
                    href="/library"
                    active={pathname === "/library"}
                />
                <NavItem
                    icon="settings"
                    label="Settings"
                    href="/settings"
                    active={pathname === "/settings" || pathname.startsWith("/connect")}
                />
            </div>
            {/* Safe area spacer for iOS home indicator */}
            <div className="h-2 w-full" />
        </nav>
    );
}
