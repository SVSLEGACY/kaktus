import React, { useEffect, useState } from "react";

// Stand-in for next/dynamic with ssr:false — loads the component in the browser only.
export default function dynamic<P extends object>(
  loader: () => Promise<React.ComponentType<P> | { default: React.ComponentType<P> }>,
  _opts?: { ssr?: boolean; loading?: () => React.ReactNode },
) {
  return React.forwardRef<unknown, P>(function Dynamic(props, ref) {
    const [Comp, setComp] = useState<React.ComponentType<any> | null>(null);
    useEffect(() => {
      let alive = true;
      loader().then((m: any) => alive && setComp(() => (m && m.default ? m.default : m)));
      return () => {
        alive = false;
      };
    }, []);
    if (!Comp) return _opts?.loading ? <>{_opts.loading()}</> : null;
    return <Comp {...(props as any)} ref={ref} />;
  }) as unknown as React.ComponentType<P & { ref?: unknown }>;
}
