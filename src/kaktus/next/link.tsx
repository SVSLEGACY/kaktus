import React from "react";
import { useRouter } from "@tanstack/react-router";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };

// Stand-in for next/link so the original kaktus pages work unchanged.
export default function Link({ href, onClick, prefetch: _p, target, ...rest }: Props) {
  const router = useRouter();
  return (
    <a
      href={href}
      target={target}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || target || /^https?:|^mailto:/.test(href) || e.metaKey || e.ctrlKey) return;
        if (href.startsWith("#")) return;
        e.preventDefault();
        const [path, hash] = href.split("#");
        router.history.push(href);
        if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 50);
        else if (path) window.scrollTo(0, 0);
      }}
      {...rest}
    />
  );
}
