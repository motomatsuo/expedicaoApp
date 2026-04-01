export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-end border-b border-border-default bg-surface px-4 md:h-16 md:px-6">
      <button
        type="button"
        className="focus-ring inline-flex h-10 items-center rounded-full border border-border-default bg-white px-4 text-sm font-medium text-primary hover:bg-gray-50"
      >
        Perfil
      </button>
    </header>
  );
}
