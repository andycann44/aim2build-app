import React from "react";
import { API_BASE } from "../api/client";

type SafeImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

const DEFAULT_FALLBACK = "/img/missing.png";

const SafeImg: React.FC<SafeImgProps> = ({
  src,
  fallbackSrc = DEFAULT_FALLBACK,
  onError,
  ...rest
}) => {
  const resolvedSrc = src;
  const initialSrc = React.useMemo(() => {
    const s = typeof src === "string" ? src.trim() : "";
    return s || fallbackSrc;
  }, [src, fallbackSrc]);

  const [currentSrc, setCurrentSrc] = React.useState(initialSrc);

  React.useEffect(() => {
    setCurrentSrc(initialSrc);
  }, [initialSrc]);

  return (
    <img
      {...rest}
      src={currentSrc}
      loading={rest.loading ?? "lazy"}
      decoding={rest.decoding ?? "async"}
      onError={(e) => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
        onError?.(e);
      }}
    />
  );
};

export default SafeImg;