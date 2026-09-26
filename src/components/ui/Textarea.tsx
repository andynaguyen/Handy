import React from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "compact";
}

export const Textarea: React.FC<TextareaProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  const baseClasses =
    "px-2 py-1 text-sm bg-background border border-mid-gray/25 rounded-lg shadow-[0_1px_1px_rgba(0,0,0,0.03)] text-start transition-[background-color,border-color] duration-150 hover:bg-mid-gray/10 hover:border-mid-gray/50 focus:outline-none focus:border-mid-gray/60 focus:ring-2 focus:ring-accent/10 resize-y";

  const variantClasses = {
    default: "px-3 py-2 min-h-[100px]",
    compact: "px-2 py-1 min-h-[80px]",
  };

  return (
    <textarea
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};
