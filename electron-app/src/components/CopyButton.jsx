import { CheckIcon, ClipboardIcon } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useEffect, useState } from "react";

export function CopyButton({ value, variant = "ghost", className, size }) {
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  }, [hasCopied]);

  return (
    <span
      className={cn("cursor-pointer", className)}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setHasCopied(true);
      }}
    >
      {hasCopied ? (
        <CheckIcon className={cn("size-4", size)} />
      ) : (
        <ClipboardIcon className={cn("size-4", size)} />
      )}
    </span>
  );
}
