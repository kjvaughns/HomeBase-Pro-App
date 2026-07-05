export function StatusBar() {
  return (
    <div className="flex justify-between items-center px-[14px] py-[5px] text-[10px] text-white font-medium z-40 relative">
      <div>9:41</div>
      <div className="flex items-center gap-1 text-[8px]">
        <span>●●●</span>
        <span>▌</span>
      </div>
    </div>
  );
}