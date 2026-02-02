import React, { useMemo, useState } from "react";

type SafeImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

const IMG_BASE =
  (import.meta as any).env?.VITE_IMG_BASE?.replace(/\/+$/, "") ||
  "https://img.aim2build.co.uk";

function resolveImgSrc(src?: string | null): string | undefined {
  if (!src) return undefined;

  // already absolute
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  // normalise leading slash
  let s = src;
  if (s.startsWith("static/")) s = "/" + s;
  if (s.startsWith("set_images/")) s = "/" + s;

  // rewrite known image roots to R2
  if (s.startsWith("/static/") || s.startsWith("/set_images/")) {
    return `${IMG_BASE}${s}`;
  }

  return src;
}

const SafeImg: React.FC<SafeImgProps> = ({
  src,
  fallbackSrc = "/missing.png",
  ...props
}) => {
  const [errored, setErrored] = useState(false);

  const finalSrc = useMemo(() => {
    if (errored) return fallbackSrc;
    return resolveImgSrc(src) || fallbackSrc;
  }, [src, errored, fallbackSrc]);

  return (
    <img
      {...props}
      src={finalSrc}
      onError={() => setErrored(true)}
    />
  );
};

export default SafeImg;