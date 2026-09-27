import { useTranslation } from "react-i18next";

interface TabsProps<T extends string> {
  tabs: readonly { id: T; labelKey: string }[];
  selected: T;
  onSelect: (id: T) => void;
}

export const Tabs = <T extends string>({
  tabs,
  selected,
  onSelect,
}: TabsProps<T>) => {
  const { t } = useTranslation();

  return (
    <div className="flex gap-6 border-b border-mid-gray/20" role="tablist">
      {tabs.map((tab) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(tab.id)}
            className={`-mb-px pb-2 text-[15px] font-medium border-b-2 transition-colors cursor-pointer ${
              isSelected
                ? "border-accent text-text"
                : "border-transparent text-text/50 hover:text-text"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
};
