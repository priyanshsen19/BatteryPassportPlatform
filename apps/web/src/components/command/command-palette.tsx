'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Command } from 'cmdk';
import {
  BatteryCharging,
  CornerDownLeft,
  FileText,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Sun,
  UsersRound,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StatusBadge } from '@/components/passports/passport-badges';
import { overlayClass } from '@/components/ui/dialog';
import { authApi } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/hooks';
import { useCan, usePassports } from '@/lib/queries';

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) throw new Error('useCommandPalette must be used inside CommandPaletteProvider');
  return context;
}

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px] text-ink select-none data-[selected=true]:bg-subtle [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-subtle';
const groupClass =
  'px-2 pb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-ink-subtle [&_[cmdk-group-heading]]:uppercase';

function PaletteBody({ close }: { close: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canCreate = useCan('passport:write');
  const canManageUsers = useCan('user:manage');
  const { setTheme } = useTheme();
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 200);
  const passports = usePassports({ q: query || undefined, limit: 8, sort: 'createdAt', order: 'desc' });

  const run = (action: () => void) => {
    close();
    action();
  };
  const go = (href: string) => run(() => router.push(href));

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search passports or jump to…"
          className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle focus-visible:outline-none"
        />
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle sm:block">
          esc
        </kbd>
      </div>

      <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain">
        <Command.Empty className="px-4 py-10 text-center text-[13px] text-ink-muted">
          {passports.isFetching ? 'Searching…' : 'No results found.'}
        </Command.Empty>

        {passports.data && passports.data.items.length > 0 && (
          <Command.Group heading={query ? 'Passports' : 'Recent passports'} className={groupClass}>
            {passports.data.items.map((passport) => {
              const info = passport.data.generalInformation;
              return (
                <Command.Item
                  key={passport.id}
                  value={`passport ${passport.id}`}
                  keywords={[
                    info.batteryIdentifier,
                    info.batteryModel.modelName,
                    info.manufacturerInformation.manufacturerName,
                  ]}
                  onSelect={() => go(`/passports/${passport.id}`)}
                  className={itemClass}
                >
                  <BatteryCharging aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono font-medium">{info.batteryIdentifier}</span>
                    <span className="block truncate text-xs text-ink-subtle">
                      {info.batteryModel.modelName} · {info.manufacturerInformation.manufacturerName}
                    </span>
                  </span>
                  <StatusBadge status={info.batteryStatus} />
                </Command.Item>
              );
            })}
          </Command.Group>
        )}

        <Command.Group heading="Navigate" className={groupClass}>
          <Command.Item onSelect={() => go('/dashboard')} className={itemClass}>
            <LayoutDashboard aria-hidden />
            Dashboard
          </Command.Item>
          <Command.Item onSelect={() => go('/passports')} className={itemClass}>
            <BatteryCharging aria-hidden />
            Passports
          </Command.Item>
          <Command.Item onSelect={() => go('/documents')} className={itemClass}>
            <FileText aria-hidden />
            Documents
          </Command.Item>
          {canManageUsers && (
            <Command.Item
              keywords={['users', 'roles', 'permissions', 'admin']}
              onSelect={() => go('/users')}
              className={itemClass}
            >
              <UsersRound aria-hidden />
              User roles
            </Command.Item>
          )}
          {canCreate && (
            <Command.Item
              keywords={['create', 'add']}
              onSelect={() => go('/passports/new')}
              className={itemClass}
            >
              <Plus aria-hidden />
              New passport
            </Command.Item>
          )}
        </Command.Group>

        <Command.Group heading="Preferences" className={groupClass}>
          <Command.Item
            keywords={['theme', 'appearance']}
            onSelect={() => run(() => setTheme('light'))}
            className={itemClass}
          >
            <Sun aria-hidden />
            Light theme
          </Command.Item>
          <Command.Item
            keywords={['theme', 'appearance']}
            onSelect={() => run(() => setTheme('dark'))}
            className={itemClass}
          >
            <Moon aria-hidden />
            Dark theme
          </Command.Item>
          <Command.Item
            keywords={['theme', 'appearance']}
            onSelect={() => run(() => setTheme('system'))}
            className={itemClass}
          >
            <Monitor aria-hidden />
            Match system theme
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Account" className={groupClass}>
          <Command.Item
            keywords={['log out', 'logout']}
            onSelect={() =>
              run(async () => {
                await authApi.logout();
                queryClient.clear();
                router.replace('/login');
              })
            }
            className={itemClass}
          >
            <LogOut aria-hidden />
            Sign out
          </Command.Item>
        </Command.Group>
      </Command.List>

      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-ink-subtle">
        <span className="flex items-center gap-1">
          <kbd className="font-mono">↑↓</kbd> to navigate
        </span>
        <span className="flex items-center gap-1">
          <CornerDownLeft className="size-3" aria-hidden /> to select
        </span>
      </div>
    </>
  );
}

/** Global ⌘K / Ctrl+K command palette for searching passports and navigating the app. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <Command.Dialog
        open={isOpen}
        onOpenChange={setOpen}
        label="Command menu"
        overlayClassName={overlayClass}
        contentClassName="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-overlay focus:outline-none"
      >
        {isOpen && <PaletteBody close={() => setOpen(false)} />}
      </Command.Dialog>
    </CommandPaletteContext.Provider>
  );
}
