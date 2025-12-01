import { CheckIcon, ClipboardIcon } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useEffect, useState } from "react";

export function CopyButton({ value, variant = "ghost", className }) {
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  }, [hasCopied]);

  return (
    <Button
      variant={variant}
      className={cn("relative text-foreground hover:bg-accent", className)}
      onClick={() => {
        navigator.clipboard.writeText(value);
        setHasCopied(true);
      }}
    >
      <span className="sr-only">Copy</span>
      {hasCopied ? <CheckIcon /> : <ClipboardIcon />}
    </Button>
  );
}
