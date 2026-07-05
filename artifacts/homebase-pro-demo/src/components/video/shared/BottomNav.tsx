const TABS = [
  { id: 'Home', icon: '⌂' },
  { id: 'Calendar', icon: '📅' },
  { id: 'Messages', icon: '💬' },
  { id: 'Clients', icon: '👤' },
  { id: 'Money', icon: '💰' },
];

export function BottomNav({ activeTab }: { activeTab: string }) {
  return (
    <div className="h-[70px] bg-[#0a0a0a] border-t border-[#1e1e1e] flex justify-around items-center px-4 pb-4 pt-2 z-40">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <div key={tab.id} className="flex flex-col items-center gap-1">
            <div className={`text-[20px] leading-none ${isActive ? 'text-[#22c55e]' : 'text-[#333]'}`}>
              {tab.icon}
            </div>
            <div className={`text-[8px] ${isActive ? 'text-[#22c55e]' : 'text-[#333]'}`}>
              {tab.id}
            </div>
          </div>
        );
      })}
    </div>
  );
}