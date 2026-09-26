import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <section className="space-y-2.5">
      {title && (
        <div className="px-1">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description && (
            <p className="text-[13px] text-text/55 mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div className="bg-card rounded-2xl overflow-visible">
        <div className="divide-y divide-mid-gray/15">{children}</div>
      </div>
    </section>
  );
};
