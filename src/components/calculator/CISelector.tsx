import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Check, ChevronsUpDown, Search, Server, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled || loading}
        >
          {isNew ? (
            <span className="flex items-center gap-2 truncate">
              <Plus className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate font-medium text-primary">Nytt objekt (manuellt)</span>
            </span>
          ) : selectedItem ? (
            <span className="flex items-center gap-2 truncate">
              <Server className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">
                {selectedItem.system_name}
                {selectedItem.object_number && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (Objekt: {selectedItem.object_number})
                  </span>
                )}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-popover border shadow-md z-50" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Sök på objektnummer, CI nummer, systemnamn..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value={NEW_CI_VALUE}
                onSelect={() => {
                  onChange(NEW_CI_VALUE);
                  setOpen(false);
                  setSearchQuery('');
                }}
                className="flex items-center gap-2 py-3 text-primary font-medium"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 shrink-0",
                    isNew ? "opacity-100" : "opacity-0"
                  )}
                />
                <Plus className="h-4 w-4" />
                Nytt (ange manuellt)
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Befintliga objekt">
              {filteredItems.length === 0 && (
                <CommandEmpty>
                  {loading ? 'Laddar...' : 'Ingen CI hittades.'}
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
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
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
        {items.length > 0 && (
          <div className="border-t p-2">
            <p className="text-xs text-muted-foreground text-center">
              {filteredItems.length} av {items.length} objekt
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
