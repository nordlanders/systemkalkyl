import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Check, ChevronsUpDown, Search, Server, Plus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

export const NEW_CI_VALUE = '__new__';

export interface ConfigurationItem {
  id: string;
  ci_number: string;
  system_name: string;
  system_owner: string | null;
  system_administrator: string | null;
  organization: string | null;
  object_number: string | null;
  service_type: string | null;
  is_active: boolean;
}

interface CISelectorProps {
  value: string;
  onChange: (ciNumber: string) => void;
  onItemChange?: (item: ConfigurationItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CISelector({ value, onChange, onItemChange, placeholder = 'Sök objekt eller CI...', disabled }: CISelectorProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConfigurationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const { data, error } = await supabase
        .from('configuration_items')
        .select('id, ci_number, system_name, system_owner, system_administrator, organization, object_number, service_type, is_active')
        .eq('is_active', true)
        .order('system_name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading CI items:', error);
    } finally {
      setLoading(false);
    }
  }

  // Notify parent when selected item changes
  const onItemChangeRef = useRef(onItemChange);
  onItemChangeRef.current = onItemChange;

  useEffect(() => {
    if (onItemChangeRef.current) {
      if (value === NEW_CI_VALUE) {
        onItemChangeRef.current(null);
      } else {
        const selectedItem = items.find(item => item.id === value) || null;
        onItemChangeRef.current(selectedItem);
      }
    }
  }, [value, items]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item =>
      (item.ci_number || '').toLowerCase().includes(query) ||
      item.system_name.toLowerCase().includes(query) ||
      (item.system_owner?.toLowerCase().includes(query)) ||
      (item.organization?.toLowerCase().includes(query)) ||
      (item.object_number?.toLowerCase().includes(query))
    );
  }, [items, searchQuery]);

  const selectedItem = value === NEW_CI_VALUE ? null : items.find(item => item.id === value);
  const isNew = value === NEW_CI_VALUE;
  const hasSelection = isNew || !!selectedItem;

  // If no selection yet, show the two prominent choice cards
  if (!hasSelection && !disabled) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Existing object card */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">Befintligt objekt</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sök bland {loading ? '...' : items.length} registrerade objekt</p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[460px] p-0 bg-popover border shadow-lg z-50" align="start">
              <Command shouldFilter={false}>
                <CommandInput 
                  placeholder="Sök på objektnummer, CI-nummer, systemnamn..." 
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList className="max-h-[300px]">
                  <CommandGroup heading={`Befintliga objekt (${filteredItems.length})`}>
                    {filteredItems.length === 0 && (
                      <CommandEmpty>
                        {loading ? 'Laddar...' : 'Inget objekt hittades.'}
                      </CommandEmpty>
                    )}
                    {filteredItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => {
                          onChange(item.id);
                          setOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex flex-col items-start gap-1 py-3"
                      >
                        <div className="flex items-center w-full">
                          <Server className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {item.system_name}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {item.object_number ? `Objekt: ${item.object_number}` : ''}
                              {(item.system_owner || item.organization) ? `${item.object_number ? ' • ' : ''}${[item.system_owner, item.organization].filter(Boolean).join(' • ')}` : ''}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* New object card */}
          <button
            type="button"
            onClick={() => onChange(NEW_CI_VALUE)}
            className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer text-center group"
          >
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <Plus className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">Nytt objekt</p>
              <p className="text-xs text-muted-foreground mt-0.5">Skapa kalkyl utan befintligt CI</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // After selection — show compact display with change button
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-md border bg-muted/30",
        isNew ? "border-primary/30" : "border-border"
      )}>
        {isNew ? (
          <>
            <Plus className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-primary text-sm">Nytt objekt (manuellt)</span>
          </>
        ) : selectedItem ? (
          <>
            <Server className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm truncate block">{selectedItem.system_name}</span>
              {selectedItem.object_number && (
                <span className="text-xs text-muted-foreground">Objekt: {selectedItem.object_number}</span>
              )}
            </div>
          </>
        ) : null}
      </div>
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange('');
            setSearchQuery('');
          }}
          className="shrink-0 text-xs"
        >
          Ändra
        </Button>
      )}
    </div>
  );
}
