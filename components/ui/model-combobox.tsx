"use client";

import { useMemo, useState } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
export interface ModelOption {
  id: string;
  name: string;
  description?: string;
}

interface ModelComboboxProps {
  label: string;
  placeholder?: string;
  value?: string;
  options: ModelOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ModelCombobox({
  label,
  placeholder = "Select a model…",
  value,
  options,
  onChange,
  disabled = false,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((option) => option.id === value),
    [options, value]
  );

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || options.length === 0}
            className="h-10 w-full justify-between font-normal"
          >
            <span className="truncate text-left">
              {selected ? (
                <>
                  <span className="font-medium">{selected.name}</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {selected.id}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <IconChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.name} ${option.id}`}
                    onSelect={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="flex w-full items-center gap-2">
                      <IconCheck
                        className={cn(
                          "size-3.5 shrink-0",
                          value === option.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-medium">{option.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {option.id}
                      </span>
                    </div>
                    {option.description && (
                      <p className="line-clamp-2 pl-5 text-[10px] text-muted-foreground">
                        {option.description}
                      </p>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
