import React from "react";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className = "", orientation = "horizontal", decorative = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role={decorative ? "none" : "separator"}
        aria-orientation={orientation}
        className={`
          shrink-0 border-0
          ${orientation === "horizontal" 
            ? "h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" 
            : "w-px h-full bg-gradient-to-b from-transparent via-gray-200 to-transparent"
          }
          ${className}
        `}
        {...props}
      />
    );
  }
);

Separator.displayName = "Separator";