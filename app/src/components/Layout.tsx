// components/Layout.tsx
import { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
    return (
        <div className="min-h-screen w-full overflow-x-hidden px-4 text-center" style={{ color: 'var(--text-primary)' }}>
            {children}
        </div>
    );
};

export default Layout;
